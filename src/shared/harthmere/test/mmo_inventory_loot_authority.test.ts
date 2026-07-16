import assert from "assert";
import {
  createHarthmereEmptyInventoryLootState,
  createHarthmereInventoryLootActor,
  createHarthmereInventoryLootBusiness,
  createHarthmereInventoryLootClientSnapshot,
  createHarthmereInventoryLootGuild,
  normalizeHarthmereInventoryLootState,
  reduceHarthmereInventoryLootMutation,
  rollHarthmereInventoryLootTable,
  type HarthmereInventoryLootItemDefinition,
  type HarthmereInventoryLootMutationContext,
  type HarthmereInventoryLootMutationRequest,
  type HarthmereInventoryLootState,
  type HarthmereInventoryLootTable,
} from "../mmo_inventory_loot_authority";

const NOW = 1_700_000_000_000;

function item(
  overrides: Partial<HarthmereInventoryLootItemDefinition> = {}
): HarthmereInventoryLootItemDefinition {
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

const itemDefinitions: Record<string, HarthmereInventoryLootItemDefinition> = {
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
    allowedStorage: [
      "backpack",
      "bank",
      "business_warehouse",
      "guild_vault",
      "weapon_locker",
    ],
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

const lootTables: Record<string, HarthmereInventoryLootTable> = {
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

const ctx: HarthmereInventoryLootMutationContext = {
  itemDefinitions,
  lootTables,
};

function request(
  operation: HarthmereInventoryLootMutationRequest["operation"],
  overrides: Partial<HarthmereInventoryLootMutationRequest> = {}
): HarthmereInventoryLootMutationRequest {
  return {
    requestId: `req_${operation}_${Math.random().toString(36).slice(2)}`,
    actorId: "p1",
    nowMs: NOW,
    operation,
    ...overrides,
  };
}

function reduce(
  state: HarthmereInventoryLootState,
  operation: HarthmereInventoryLootMutationRequest["operation"],
  overrides: Partial<HarthmereInventoryLootMutationRequest> = {}
) {
  return reduceHarthmereInventoryLootMutation(
    state,
    request(operation, overrides),
    ctx
  );
}

describe("mmo_inventory_loot_authority oversights", () => {
  it("normalizes and exposes equipped durable item instances", () => {
    const instanceId = "equipped_sword_instance";
    const normalized = normalizeHarthmereInventoryLootState({
      actors: {
        p1: {
          actorId: "p1",
          equipment: { main_hand: "iron_sword" },
          equipmentInstances: { main_hand: instanceId },
        },
      },
      itemInstances: {
        [instanceId]: {
          instanceId,
          itemId: "iron_sword",
          quantity: 1,
          ownerKind: "actor",
          ownerId: "p1",
          location: "actor_equipment",
          slot: "main_hand",
          createdAtMs: NOW,
          updatedAtMs: NOW,
          condition: 1,
          quality: 1,
          legalFlags: [],
          upgradedLevel: 0,
          enchantments: [],
          contaminated: false,
          broken: false,
          audit: [],
        },
      },
    });
    const snapshot = createHarthmereInventoryLootClientSnapshot(
      normalized,
      "p1"
    );

    assert.deepEqual(snapshot.actor?.equipmentInstances, {
      main_hand: instanceId,
    });
    assert.equal(
      snapshot.itemInstances[instanceId]?.location,
      "actor_equipment"
    );
  });

  it("routes currency grants to wallet gold and rejects invalid counts", () => {
    let state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1");

    const bad = reduce(state, "grant_stack", { itemId: "gold_coin", count: 0 });
    assert.ok(!bad.ok);
    assert.ok(bad.errors.includes("invalid_count"));

    const granted = reduce(state, "grant_stack", {
      itemId: "gold_coin",
      count: 7,
    });
    assert.ok(granted.ok, granted.errors.join(", "));
    state = granted.state;
    assert.equal(state.actors.p1.gold, 7);
    assert.equal(state.actors.p1.items.gold_coin, undefined);
  });

  it("counts item instances against backpack capacity", () => {
    const state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1", {
      maxInventorySlots: 1,
      items: { iron_ore: 1 },
    });

    const result = reduce(state, "create_item_instance", {
      itemId: "iron_sword",
    });
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("inventory_full"));
  });

  it("records first-time tags for stack drops, not only instance drops", () => {
    let state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1");

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

    const secondRoll = rollHarthmereInventoryLootTable(
      lootTables.stack_first_time,
      ctx,
      4,
      state.actorLootTags.p1
    );
    assert.equal(
      secondRoll.some((entry) => entry.itemId === "keystone_fragment"),
      false
    );
  });

  it("never selects a zero-weight weighted-drop entry regardless of RNG seed", () => {
    const table: HarthmereInventoryLootTable = {
      tableId: "weighted_zero",
      sourceTypes: ["chest"],
      tags: [],
      rolls: 1,
      guaranteedDrops: [],
      weightedDrops: [
        // Leading "disabled" entry; must never drop even when rand() yields exactly 0.
        { itemId: "iron_sword", minCount: 1, maxCount: 1, weight: 0 },
        { itemId: "iron_ore", minCount: 1, maxCount: 1, weight: 100 },
      ],
      rareDrops: [],
      questDrops: [],
    };
    for (let seed = 1; seed <= 300; seed++) {
      const rolled = rollHarthmereInventoryLootTable(table, ctx, seed);
      assert.equal(
        rolled.some((e) => e.itemId === "iron_sword"),
        false,
        `zero-weight selected at seed ${seed}`
      );
      assert.equal(
        rolled.some((e) => e.itemId === "iron_ore"),
        true,
        `positive-weight entry missing at seed ${seed}`
      );
    }
  });

  it("requires active guild membership for guild loot assignment and targets", () => {
    let state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1", {
      guildId: "guild_1",
    });
    state.actors.p2 = createHarthmereInventoryLootActor("p2");
    state.actors.p3 = createHarthmereInventoryLootActor("p3");
    state.guilds.guild_1 = createHarthmereInventoryLootGuild(
      "guild_1",
      ["p1"],
      {
        vault: { iron_ore: 4 },
      }
    );

    const nonMemberTarget = reduce(state, "assign_guild_loot", {
      guildId: "guild_1",
      itemId: "iron_ore",
      count: 1,
      targetOwnerId: "p2",
    });
    assert.ok(!nonMemberTarget.ok);
    assert.ok(
      nonMemberTarget.errors.includes("target_not_active_guild_member")
    );

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
    let state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1", {
      guildId: "guild_1",
    });
    state.guilds.guild_1 = createHarthmereInventoryLootGuild(
      "guild_1",
      ["p1"],
      {
        lootRule: "guild_project",
        maxSlots: 0,
      }
    );

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
    const state = createHarthmereEmptyInventoryLootState();
    state.actors.p1 = createHarthmereInventoryLootActor("p1");
    state.businesses.shop = createHarthmereInventoryLootBusiness(
      "shop",
      "general_trader",
      "p1",
      "town",
      "region",
      {
        inventory: { iron_ore: 2 },
        storage: { business_warehouse: { iron_ore: 2 }, cold_storage: {} },
      }
    );

    const result = reduce(state, "move_from_business_inventory", {
      businessId: "shop",
      itemId: "iron_ore",
      count: 1,
      storageClass: "cold_storage",
    });
    assert.ok(!result.ok);
    assert.ok(
      result.errors.includes("insufficient_business_storage_item_count")
    );
  });
});
