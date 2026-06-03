import assert from "assert";
import { readHarthmereLiveModeInventoryLootStateForActorV1 } from "../live_mode_inventory_loot_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_inventory_loot_001";
const NOW_MS = 1_800_003_000_000;

describe("live_mode_inventory_loot_state API route integration", () => {
  it("hydrates actor inventory, material storage, overflow, and equipment without overwriting state", async () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
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
          return JSON.stringify(state);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeInventoryLootStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(reads, [harthmereLiveModePlayerStateKeyV1(ACTOR)]);
    assert.equal((snapshot as any).actor.gold, 77);
    assert.equal((snapshot as any).actor.items.audit_ore, 5);
    assert.equal((snapshot as any).actor.bank.audit_ingot, 2);
    assert.equal((snapshot as any).actor.equipment.main_hand, "audit_sword");
    assert.equal((snapshot as any).overflow[0].itemId, "audit_quest_badge");
    assert.equal((snapshot as any).materialStorage.items.audit_ore, 3);
    assert.equal((snapshot as any).materialStorage.usedSlots, 1);
    assert.ok((snapshot as any).materialStorage.maxSlots >= 1);
  });
});
