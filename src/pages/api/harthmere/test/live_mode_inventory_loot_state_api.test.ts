import assert from "assert";
import {
  readHarthmereLiveModeInventoryLootBackendStateForActor,
  readHarthmereLiveModeInventoryLootStateForActor,
} from "../live_mode_inventory_loot_state";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereNativeEcsPlansForAvailableInventoryLoot,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
} from "@/shared/harthmere/live_mode_backend";

const ACTOR = "player_api_inventory_loot_001";
const NOW_MS = 1_800_003_000_000;

describe("live_mode_inventory_loot_state API route integration", () => {
  it("hydrates actor inventory, material storage, overflow, and equipment without overwriting state", async () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    state.inventory.gold = 77;
    state.inventory.items.audit_ore = 5;
    state.inventory.bank.audit_ingot = 2;
    state.inventory.equipment.main_hand = "audit_sword";
    state.inventory.overflow.push({
      itemId: "audit_quest_badge",
      count: 1,
      reason: "inventory_full",
    });
    state.banking.materialStorage.audit_ore = 3;
    state.banking.materialStorageMaxSlots = 12;

    const reads: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          reads.push(key);
          return key === harthmereLiveModePlayerStateKey(ACTOR)
            ? JSON.stringify(state)
            : null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeInventoryLootStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(reads, [
      harthmereLiveModePlayerStateKey(ACTOR),
      harthmereLiveModeSharedWorldStateKey(),
    ]);
    assert.equal((snapshot as any).actor.gold, 77);
    assert.equal((snapshot as any).actor.items.audit_ore, 5);
    assert.equal((snapshot as any).actor.bank.audit_ingot, 2);
    assert.equal((snapshot as any).actor.equipment.main_hand, "audit_sword");
    assert.equal((snapshot as any).overflow[0].itemId, "audit_quest_badge");
    assert.equal((snapshot as any).materialStorage.items.audit_ore, 3);
    assert.equal((snapshot as any).materialStorage.usedSlots, 1);
    assert.ok((snapshot as any).materialStorage.maxSlots >= 1);
  });

  it("repairs pre-migration shared drops into native materialization plans on read", async () => {
    const playerState = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const sharedWriter = defaultHarthmereLiveModeBackendState(
      "world-writer",
      NOW_MS
    );
    sharedWriter.inventoryLoot.lootDrops.legacy_drop = {
      dropId: "legacy_drop",
      sourceKind: "legacy_throw",
      sourceId: "legacy_throw",
      position: { x: 4, y: 5, z: 6 },
      itemStacks: { rough_stone: 2 },
      instanceIds: [],
      ownerActorIds: [ACTOR],
      pickupToken: "legacy-token",
      createdAtMs: NOW_MS - 1_000,
      expiresAtMs: NOW_MS + 60_000,
      status: "available",
      abuseFlags: [],
    };
    const shared = createHarthmereLiveModeSharedWorldState(
      sharedWriter,
      NOW_MS
    );
    const redis = {
      primary: {
        get: async (key: string) =>
          key === harthmereLiveModePlayerStateKey(ACTOR)
            ? JSON.stringify(playerState)
            : key === harthmereLiveModeSharedWorldStateKey()
            ? JSON.stringify(shared)
            : null,
      },
    };

    const state = await readHarthmereLiveModeInventoryLootBackendStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });
    const plans = harthmereNativeEcsPlansForAvailableInventoryLoot(
      state,
      NOW_MS
    );
    assert.equal(plans.length, 1);
    assert.equal(plans[0].materializationKey, "inventory-loot:legacy_drop");
    assert.deepEqual(plans[0].itemStacks, { rough_stone: 2 });
  });
});
