import assert from "assert";

// HARTHMERE_LIVE_INVENTORY_SNAPSHOT (audit fix, 2026-07-13)
//
// Covers the Road Ahead "Carry a Muck Buster" soft-lock: in live-authoritative
// sessions the localStorage inventory is deliberately dropped from display
// (HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE) while the tool lives in the
// SERVER inventory — the craft step must therefore also consult the last
// known live server inventory. These tests pin the module-level snapshot
// recorder and the mission bridge's use of it.

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
};
(globalThis as any).window = {
  localStorage: localStorageMock,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

import {
  readHarthmereLiveInventoryItemCount,
  recordHarthmereLiveInventoryItemsSnapshot,
  resetHarthmereLiveInventoryItemsSnapshotForTest,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  snapshotRoadAheadHasLocalMuckClearingToolForTest,
  snapshotRoadAheadMuckClearingToolItemIds,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";

describe("HARTHMERE_LIVE_INVENTORY_SNAPSHOT", () => {
  beforeEach(() => {
    storage.clear();
    resetHarthmereLiveInventoryItemsSnapshotForTest();
  });

  it("records actor item counts from a live-mode response body", () => {
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: { items: { muck_buster: 1, wild_berries: 4 } },
      },
    });
    assert.strictEqual(readHarthmereLiveInventoryItemCount("muck_buster"), 1);
    assert.strictEqual(readHarthmereLiveInventoryItemCount("wild_berries"), 4);
    assert.strictEqual(readHarthmereLiveInventoryItemCount("iron_ore"), 0);
  });

  it("ignores malformed bodies and non-positive counts", () => {
    recordHarthmereLiveInventoryItemsSnapshot(undefined);
    recordHarthmereLiveInventoryItemsSnapshot({});
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: { actor: { items: ["not", "a", "record"] } },
    });
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: { items: { muck_buster: 0, bad: -3, weird: "x" } },
      },
    });
    assert.strictEqual(readHarthmereLiveInventoryItemCount("muck_buster"), 0);
    assert.strictEqual(readHarthmereLiveInventoryItemCount("bad"), 0);
    assert.strictEqual(readHarthmereLiveInventoryItemCount("weird"), 0);
  });

  it("a newer snapshot replaces the previous one (consumed tools stop counting)", () => {
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: { actor: { items: { muck_buster: 1 } } },
    });
    assert.strictEqual(readHarthmereLiveInventoryItemCount("muck_buster"), 1);
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: { actor: { items: { wild_berries: 2 } } },
    });
    assert.strictEqual(readHarthmereLiveInventoryItemCount("muck_buster"), 0);
  });

  describe("Road Ahead muck-buster step (soft-lock fix)", () => {
    it("completes from the live server inventory even with empty localStorage", () => {
      // localStorage inventory is empty (fresh device) — before the fix this
      // returned false and the step soft-locked.
      assert.strictEqual(
        snapshotRoadAheadHasLocalMuckClearingToolForTest(),
        false
      );
      recordHarthmereLiveInventoryItemsSnapshot({
        inventoryLootState: { actor: { items: { muck_buster: 1 } } },
      });
      assert.strictEqual(
        snapshotRoadAheadHasLocalMuckClearingToolForTest(),
        true
      );
    });

    it("accepts every catalogued muck-clearing tool id from the live inventory", () => {
      for (const itemId of snapshotRoadAheadMuckClearingToolItemIds()) {
        resetHarthmereLiveInventoryItemsSnapshotForTest();
        recordHarthmereLiveInventoryItemsSnapshot({
          inventoryLootState: { actor: { items: { [itemId]: 1 } } },
        });
        assert.strictEqual(
          snapshotRoadAheadHasLocalMuckClearingToolForTest(),
          true,
          `live-owned ${itemId} must satisfy the craft step`
        );
      }
    });
  });
});
