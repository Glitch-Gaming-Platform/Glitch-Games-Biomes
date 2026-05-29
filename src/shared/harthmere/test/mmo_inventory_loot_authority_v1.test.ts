import assert from "assert";
import {
  createHarthmereEmptyInventoryLootStateV1,
  createHarthmereInventoryLootActorV1,
  createHarthmereInventoryLootBusinessV1,
  createHarthmereInventoryLootGuildV1,
  reduceHarthmereInventoryLootMutationV1,
  rollHarthmereInventoryLootTableV1,
  type HarthmereInventoryLootItemDefinitionV1,
  type HarthmereInventoryLootMutationContextV1,
  type HarthmereInventoryLootMutationRequestV1,
  type HarthmereInventoryLootStateV1,
  type HarthmereInventoryLootTableV1,
} from "../mmo_inventory_loot_authority_v1";

const NOW = 1_700_000_000_000;

function item(overrides: Partial<HarthmereInventoryLootItemDefinitionV1> = {}): HarthmereInventoryLootItemDefinitionV1 {
  return {
    itemId: "iron_ore",
    displayName: "Iron Ore",
    category: "material",
    rarity: "common",
    maxStackSize: 200,
    baseValueGold: 3,
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

const itemDefinitions: Record<string, HarthmereInventoryLootItemDefinitionV1> = {
  iron_ore: item(),
  gold_coin: item({
    itemId: "gold_coin",
    displayName: "Gold Coin",
    category: "currency",
    maxStackSize: 9999,
    allowedStorage: ["backpack"],
    businessUses: [],
    townNeeds: [],
  }),
  iron_sword: item({
    itemId: "iron_sword",
    displayName: "Iron Sword",
    category: "weapon",
    rarity: "uncommon",
    maxStackSize: 1,
    allowedStorage: ["backpack", "bank", "business_warehouse", "guild_vault", "weapon_locker"],
    businessUses: ["general_trader", "weapons_tools"],
    townNeeds: ["safety"],
    durabilityMax: 100,
    repairable: true,
    uniqueInstance: true,
  }),
  keystone_fragment: item({
    itemId: "keystone_fragment",
    displayName: "Keystone Fragment",
    category: "quest",
    maxStackSize: 20,
    binding: "quest",
    tradeable: false,
    legalClass: "quest_bound",
    businessUses: [],
    townNeeds: ["knowledge"],
  }),
};

const lootTables: Record<string, HarthmereInventoryLootTableV1> = {
  stack_first_time: {
    tableId: "stack_first_time",
    sourceTypes: ["chest"],
    tags: ["quest"],
    rolls: 0,
    guaranteedDrops: [],
    weightedDrops: [],
    rareDrops: [],
    questDrops: [
      {
        itemId: "keystone_fragment",
        minCount: 1,
        maxCount: 1,
        weight: 1,
        firstTimeTag: "keystone_fragment_intro",
      },
    ],
  },
};

const ctx: HarthmereInventoryLootMutationContextV1 = {
  itemDefinitions,
  lootTables,
};

function request(
  operation: HarthmereInventoryLootMutationRequestV1["operation"],
  overrides: Partial<HarthmereInventoryLootMutationRequestV1> = {}
): HarthmereInventoryLootMutationRequestV1 {
  return {
    requestId: `req_${operation}_${Math.random().toString(36).slice(2)}`,
    actorId: "p1",
    nowMs: NOW,
    operation,
    ...overrides,
  };
}

function reduce(
  state: HarthmereInventoryLootStateV1,
  operation: HarthmereInventoryLootMutationRequestV1["operation"],
  overrides: Partial<HarthmereInventoryLootMutationRequestV1> = {}
) {
  return reduceHarthmereInventoryLootMutationV1(state, request(operation, overrides), ctx);
}

describe("mmo_inventory_loot_authority_v1 oversights", () => {
  it("routes currency grants to wallet gold and rejects invalid counts", () => {
    let state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1");

    const bad = reduce(state, "grant_stack", { itemId: "gold_coin", count: 0 });
    assert.ok(!bad.ok);
    assert.ok(bad.errors.includes("invalid_count"));

    const granted = reduce(state, "grant_stack", { itemId: "gold_coin", count: 7 });
    assert.ok(granted.ok, granted.errors.join(", "));
    state = granted.state;
    assert.equal(state.actors.p1.gold, 7);
    assert.equal(state.actors.p1.items.gold_coin, undefined);
  });

  it("counts item instances against backpack capacity", () => {
    const state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1", {
      maxInventorySlots: 1,
      items: { iron_ore: 1 },
    });

    const result = reduce(state, "create_item_instance", { itemId: "iron_sword" });
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("inventory_full"));
  });

  it("records first-time tags for stack drops, not only instance drops", () => {
    let state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1");

    const created = reduce(state, "create_loot_drop", {
      lootTableId: "stack_first_time",
      sourceKind: "chest",
      sourceId: "intro_chest",
      ownerActorIds: ["p1"],
      rngSeed: 4,
    });
    assert.ok(created.ok, created.errors.join(", "));
    state = created.state;
    const dropId = Object.keys(state.lootDrops)[0];
    const claimed = reduce(state, "claim_loot_drop", {
      dropId,
      pickupToken: state.lootDrops[dropId].pickupToken,
    });
    assert.ok(claimed.ok, claimed.errors.join(", "));
    state = claimed.state;
    assert.ok(state.actorLootTags.p1.includes("keystone_fragment_intro"));

    const secondRoll = rollHarthmereInventoryLootTableV1(
      lootTables.stack_first_time,
      ctx,
      4,
      state.actorLootTags.p1
    );
    assert.equal(secondRoll.some((entry) => entry.itemId === "keystone_fragment"), false);
  });

  it("requires active guild membership for guild loot assignment and targets", () => {
    let state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1", { guildId: "guild_1" });
    state.actors.p2 = createHarthmereInventoryLootActorV1("p2");
    state.actors.p3 = createHarthmereInventoryLootActorV1("p3");
    state.guilds.guild_1 = createHarthmereInventoryLootGuildV1("guild_1", ["p1"], {
      vault: { iron_ore: 4 },
    });

    const nonMemberTarget = reduce(state, "assign_guild_loot", {
      guildId: "guild_1",
      itemId: "iron_ore",
      count: 1,
      targetOwnerId: "p2",
    });
    assert.ok(!nonMemberTarget.ok);
    assert.ok(nonMemberTarget.errors.includes("target_not_active_guild_member"));

    state.guilds.guild_1.members.p2 = { joinedAtMs: NOW };
    const nonMemberActor = reduce(state, "assign_guild_loot", {
      actorId: "p3",
      guildId: "guild_1",
      itemId: "iron_ore",
      count: 1,
      targetOwnerId: "p1",
    });
    assert.ok(!nonMemberActor.ok);
    assert.ok(nonMemberActor.errors.includes("actor_not_active_guild_member"));

    const assigned = reduce(state, "assign_guild_loot", {
      guildId: "guild_1",
      itemId: "iron_ore",
      count: 2,
      targetOwnerId: "p2",
    });
    assert.ok(assigned.ok, assigned.errors.join(", "));
    state = assigned.state;
    assert.equal(state.actors.p2.items.iron_ore, 2);
    assert.equal(state.guilds.guild_1.vault.iron_ore, 2);
  });

  it("checks guild vault capacity before claiming guild-project loot", () => {
    let state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1", { guildId: "guild_1" });
    state.guilds.guild_1 = createHarthmereInventoryLootGuildV1("guild_1", ["p1"], {
      lootRule: "guild_project",
      maxSlots: 0,
    });

    const created = reduce(state, "create_loot_drop", {
      itemId: "iron_ore",
      count: 1,
      sourceKind: "boss",
      sourceId: "boss_1",
      ownerActorIds: ["p1"],
      guildId: "guild_1",
    });
    assert.ok(created.ok, created.errors.join(", "));
    state = created.state;
    const dropId = Object.keys(state.lootDrops)[0];
    const claimed = reduce(state, "claim_loot_drop", {
      dropId,
      pickupToken: state.lootDrops[dropId].pickupToken,
    });
    assert.ok(!claimed.ok);
    assert.ok(claimed.errors.includes("guild_vault_full_or_stack_exceeded"));
  });

  it("does not let a business withdraw from the wrong storage class", () => {
    const state = createHarthmereEmptyInventoryLootStateV1();
    state.actors.p1 = createHarthmereInventoryLootActorV1("p1");
    state.businesses.shop = createHarthmereInventoryLootBusinessV1("shop", "general_trader", "p1", "town", "region", {
      inventory: { iron_ore: 2 },
      storage: { business_warehouse: { iron_ore: 2 }, cold_storage: {} },
    });

    const result = reduce(state, "move_from_business_inventory", {
      businessId: "shop",
      itemId: "iron_ore",
      count: 1,
      storageClass: "cold_storage",
    });
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("insufficient_business_storage_item_count"));
  });
});
