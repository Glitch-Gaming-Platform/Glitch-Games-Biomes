/// <reference types="mocha" />

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  applyHarthmereInventoryMutationResult,
  reduceHarthmereInventoryMutation,
  registerHarthmereCraftingRecipe,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  type HarthmereInventoryMutationKind,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
  type HarthmereItemDefinition,
} from "../mmo_inventory_authority";
import {
  createHarthmereEmptyInventoryLootState,
  createHarthmereInventoryLootActor,
  reduceHarthmereInventoryLootMutation,
  type HarthmereInventoryLootItemDefinition,
} from "../mmo_inventory_loot_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const ACTOR = "inventory_full_stack_player";
const NOW_MS = 1_800_002_000_000;

function item(
  overrides: Partial<HarthmereItemDefinition> = {}
): HarthmereItemDefinition {
  return {
    itemId: "audit_ore",
    displayName: "Audit Ore",
    maxStackSize: 99,
    baseValue: 5,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 1 },
    tradeable: true,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
  return {
    actorId: ACTOR,
    gold: 250,
    equipment: {},
    items: {},
    bank: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function mutate(
  kind: HarthmereInventoryMutationKind,
  base: HarthmereInventorySnapshot,
  overrides: Partial<HarthmereInventoryMutationRequest> = {}
) {
  return reduceHarthmereInventoryMutation(
    {
      requestId: `inventory-audit-${kind}`,
      actorId: ACTOR,
      kind,
      nowMs: NOW_MS,
      ...overrides,
    } as HarthmereInventoryMutationRequest,
    {
      snapshot: base,
      playerLevel: 10,
      playerSkills: { smithing: { level: 3 } },
      reputation: { city_guard: 2 },
    }
  );
}

let sequence = 0;

function state() {
  return defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
}

function envelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  sequence += 1;
  return {
    requestId: `inventory-system-${sequence}`,
    idempotencyKey: `inventory-system-idem-${sequence}`,
    actorId: ACTOR,
    actionKind,
    subsystem: "inventory",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: sequence,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

function apply(
  current: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  return reduceHarthmereLiveModeBackendState(
    current,
    envelope(actionKind, payload, overrides),
    NOW_MS
  );
}

function lootItem(
  overrides: Partial<HarthmereInventoryLootItemDefinition> = {}
): HarthmereInventoryLootItemDefinition {
  return {
    itemId: "audit_ore",
    displayName: "Audit Ore",
    category: "material",
    rarity: "common",
    maxStackSize: 99,
    baseValueGold: 5,
    weight: 1,
    volume: 1,
    binding: "none",
    tradeable: true,
    legalClass: "common",
    allowedStorage: ["backpack", "bank", "business_warehouse", "guild_vault"],
    businessUses: ["general_trader"],
    jobUses: ["gather", "craft"],
    townNeeds: ["maintenance"],
    perishable: false,
    hazardLevel: 0,
    contaminationRisk: 0,
    repairable: false,
    lootTableTags: [],
    uniqueInstance: false,
    ...overrides,
  };
}

before(function registerInventoryFullStackItems() {
  registerHarthmereItemDefinition(item());
  registerHarthmereItemDefinition(
    item({
      itemId: "audit_sword",
      displayName: "Audit Sword",
      maxStackSize: 1,
      baseValue: 100,
      isCraftingMaterial: false,
      stats: { attack: 10, weight: 3 },
    })
  );
  registerHarthmereItemDefinition(
    item({
      itemId: "audit_potion",
      displayName: "Audit Potion",
      maxStackSize: 10,
      baseValue: 20,
      isCraftingMaterial: false,
      isConsumable: true,
      consumableCooldownCategory: "potion",
      consumableCooldownMs: 30_000,
      stats: {},
    })
  );
  registerHarthmereItemDefinition(
    item({
      itemId: "audit_tome",
      displayName: "Audit Tome",
      maxStackSize: 1,
      baseValue: 200,
      isCraftingMaterial: false,
      isSpellTome: true,
      grantsAbilityId: "audit_fireball",
      stats: {},
    })
  );
  registerHarthmereItemDefinition(
    item({
      itemId: "audit_quest_badge",
      displayName: "Audit Quest Badge",
      maxStackSize: 5,
      baseValue: 0,
      binding: "quest",
      isQuestItem: true,
      isCraftingMaterial: false,
      tradeable: false,
      stats: {},
    })
  );
  registerHarthmereItemDefinition(
    item({
      itemId: "audit_ingot",
      displayName: "Audit Ingot",
      maxStackSize: 99,
      baseValue: 15,
      isCraftingMaterial: true,
    })
  );
  registerHarthmereVendorEntry({
    vendorId: "audit_blacksmith",
    itemId: "audit_sword",
    buyPrice: 120,
    sellPrice: 60,
    stock: 1,
    requiredFaction: "city_guard",
    requiredReputationTier: 1,
  });
  registerHarthmereCraftingRecipe({
    recipeId: "audit_smelt_ingot",
    outputItemId: "audit_ingot",
    outputCount: 1,
    inputs: [{ itemId: "audit_ore", count: 2 }],
    requiredLevel: 1,
    requiredSkillId: "smithing",
    requiredSkillLevel: 1,
    craftingTimeMs: 500,
    xpReward: 10,
  });
});

describe("inventory system full stack audit", () => {
  it("validates every core backend mutation path and rejects protected item mistakes", () => {
    let current = snapshot({
      gold: 500,
      items: { audit_ore: 4 },
      knownRecipes: ["audit_smelt_ingot"],
    });

    const buy = mutate("buy_from_vendor", current, {
      vendorId: "audit_blacksmith",
      itemId: "audit_sword",
      count: 1,
    });
    assert.equal(buy.ok, true, buy.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, buy);
    assert.equal(current.items.audit_sword, 1);
    assert.equal(current.gold, 380);

    const equip = mutate("equip_item", current, {
      itemId: "audit_sword",
      targetSlot: "main_hand",
    });
    assert.equal(equip.ok, true, equip.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, equip);
    assert.equal(current.equipment.main_hand, "audit_sword");
    assert.equal(current.items.audit_sword, undefined);

    const unequip = mutate("unequip_item", current, { sourceSlot: "main_hand" });
    assert.equal(unequip.ok, true, unequip.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, unequip);
    assert.equal(current.items.audit_sword, 1);
    assert.equal(current.equipment.main_hand, undefined);

    const craft = mutate("craft_item", current, {
      recipeId: "audit_smelt_ingot",
    });
    assert.equal(craft.ok, true, craft.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, craft);
    assert.equal(current.items.audit_ore, 2);
    assert.equal(current.items.audit_ingot, 1);

    const bank = mutate("transfer_to_bank", current, {
      bankItemId: "audit_ingot",
      bankCount: 1,
    });
    assert.equal(bank.ok, true, bank.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, bank);
    assert.equal(current.items.audit_ingot, undefined);
    assert.equal(current.bank.audit_ingot, 1);

    const withdraw = mutate("withdraw_from_bank", current, {
      bankItemId: "audit_ingot",
      bankCount: 1,
    });
    assert.equal(withdraw.ok, true, withdraw.errors.join(", "));
    current = applyHarthmereInventoryMutationResult(current, withdraw);
    assert.equal(current.items.audit_ingot, 1);
    assert.equal(current.bank.audit_ingot, undefined);

    const tome = mutate("learn_spell_from_tome", {
      ...current,
      items: { ...current.items, audit_tome: 1 },
    }, {
      itemId: "audit_tome",
      count: 1,
    });
    assert.equal(tome.ok, true, tome.errors.join(", "));
    assert.deepEqual(tome.newAbilityIds, ["audit_fireball"]);

    const protectedSnapshot = snapshot({
      items: { audit_quest_badge: 1 },
    });
    const dropQuest = mutate("drop_item", protectedSnapshot, {
      itemId: "audit_quest_badge",
      count: 1,
    });
    assert.equal(dropQuest.ok, false);
    assert.ok(dropQuest.errors.includes("cannot_drop_quest_item"));

    const destroyQuest = mutate("destroy_item", protectedSnapshot, {
      itemId: "audit_quest_badge",
      count: 1,
    });
    assert.equal(destroyQuest.ok, false);
    assert.ok(destroyQuest.errors.includes("cannot_destroy_quest_item"));

    const bankQuest = mutate("transfer_to_bank", protectedSnapshot, {
      bankItemId: "audit_quest_badge",
      bankCount: 1,
    });
    assert.equal(bankQuest.ok, false);
    assert.ok(bankQuest.errors.includes("cannot_bank_quest_item"));
  });

  it("persists live reducer grants, admin authority checks, loot claims, overflow, and client inventory snapshots", () => {
    let current = state();
    current.inventory.gold = 10;

    const rejected = apply(
      current,
      "request_inventory_mutation",
      { itemId: "audit_ore", count: 1 },
      { source: "client_request", subsystem: "inventory" }
    );
    assert.ok(
      rejected.summary.warnings.includes(
        "inventory_rejected:admin_authority_required"
      )
    );
    assert.equal(rejected.state.inventory.items.audit_ore, undefined);

    const granted = apply(
      current,
      "request_inventory_mutation",
      { itemId: "audit_potion", count: 3 },
      { source: "server_scheduled_tick", subsystem: "inventory" }
    );
    current = granted.state;
    assert.equal(current.inventory.items.audit_potion, 3);
    assert.ok(granted.summary.touchedModels.includes("inventory_items"));

    current.inventory.overflow.push({
      itemId: "audit_quest_badge",
      count: 1,
      reason: "inventory_full",
    });
    current.banking.materialStorage.audit_ore = 2;
    current.banking.materialStorageMaxSlots = 8;
    const clientSnapshot =
      require("../live_mode_backend").createHarthmereInventoryLootClientSnapshotFromBackend(
        current
      );
    assert.equal(clientSnapshot.actor.items.audit_potion, 3);
    assert.equal(clientSnapshot.overflow[0].itemId, "audit_quest_badge");
    assert.equal(clientSnapshot.materialStorage.items.audit_ore, 2);
    assert.equal(clientSnapshot.materialStorage.maxSlots, 8);

    let lootState = createHarthmereEmptyInventoryLootState();
    lootState.actors[ACTOR] = createHarthmereInventoryLootActor(ACTOR);
    const created = reduceHarthmereInventoryLootMutation(
      lootState,
      {
        requestId: "inventory-loot-create",
        actorId: ACTOR,
        nowMs: NOW_MS,
        operation: "create_loot_drop",
        itemId: "audit_ore",
        count: 2,
        sourceKind: "monster",
        sourceId: "mucker_audit",
        ownerActorIds: [ACTOR],
      },
      { itemDefinitions: { audit_ore: lootItem() }, lootTables: {} }
    );
    assert.equal(created.ok, true, created.errors.join(", "));
    lootState = created.state;
    const dropId = Object.keys(lootState.lootDrops)[0];
    const claimed = reduceHarthmereInventoryLootMutation(
      lootState,
      {
        requestId: "inventory-loot-claim",
        actorId: ACTOR,
        nowMs: NOW_MS,
        operation: "claim_loot_drop",
        dropId,
        pickupToken: lootState.lootDrops[dropId].pickupToken,
      },
      { itemDefinitions: { audit_ore: lootItem() }, lootTables: {} }
    );
    assert.equal(claimed.ok, true, claimed.errors.join(", "));
    assert.equal(claimed.state.actors[ACTOR].items.audit_ore, 2);
    assert.equal(claimed.state.lootDrops[dropId].status, "claimed");
  });
});
