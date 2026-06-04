// HARTHMERE_OBJECT_CONTAINER_UI_V199:
// Verifies that world-object containers behave like a real inventory: opening
// seeds them from the loot table, items can be taken into the player inventory
// and stored back, and an emptied container is NOT re-seeded on re-open.
import assert from "assert";

// A minimal browser shim so the localStorage-backed container + inventory
// modules run under node. Must be installed before importing the modules.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  },
};
const windowMock = {
  localStorage: localStorageMock,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
};
(globalThis as unknown as { window: unknown }).window = windowMock;

import {
  grantHarthmereItem,
  harthmereInventoryCountByItemIdV141,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  getOrSeedHarthmereContainerV1,
  putIntoHarthmereContainerV1,
  readHarthmereContainerV1,
  takeAllFromHarthmereContainerV1,
  takeFromHarthmereContainerV1,
} from "@/client/components/challenges/harthmereObjectContainers";
import {
  harthmereContainerEnterActionV1,
  resolveHarthmereContainerTransferV1,
} from "@/client/components/challenges/harthmereContainerTransferInteractionV1";
import type { BiomesId } from "@/shared/ids";

function countInContainer(key: string, itemId: string): number {
  const record = readHarthmereContainerV1(key);
  if (!record) {
    return 0;
  }
  return record.items
    .filter((slot) => slot.itemId === itemId)
    .reduce((sum, slot) => sum + slot.quantity, 0);
}

describe("harthmere object container take/store interface", () => {
  beforeEach(() => {
    // Re-point the global window at this file's mock; see the matching note in
    // harthmereGatheringNodeWorldInteraction.test.ts.
    (globalThis as unknown as { window: unknown }).window = windowMock;
    localStorageMock.clear();
  });

  // The Road Ahead clothing only appears once the quest reaches the gear-up
  // step; pass questClothingReady so these transfer tests exercise the filled crate.
  const READY = { questClothingReady: true } as const;

  it("seeds the Clothing Crate with both clothing halves for The Road Ahead", () => {
    const entityId = 4242 as BiomesId;
    const record = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", READY);
    assert.equal(countInContainer(record.key, "baker_apron"), 1);
    assert.equal(countInContainer(record.key, "field_trousers"), 1);
    assert.equal(countInContainer(record.key, "cloth_scrap"), 4);
  });

  it("moves an item from the container into the player inventory on Take", () => {
    const entityId = 4243 as BiomesId;
    const { key } = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", READY);
    const before = harthmereInventoryCountByItemIdV141("baker_apron");
    const taken = takeFromHarthmereContainerV1(key, "baker_apron", 1);
    assert.equal(taken, 1);
    assert.equal(countInContainer(key, "baker_apron"), 0);
    assert.equal(
      harthmereInventoryCountByItemIdV141("baker_apron"),
      before + 1
    );
  });

  it("stores a player item back into the container on Store", () => {
    const entityId = 4244 as BiomesId;
    const { key } = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", READY);
    takeFromHarthmereContainerV1(key, "baker_apron", 1);
    assert.equal(harthmereInventoryCountByItemIdV141("baker_apron"), 1);
    const stored = putIntoHarthmereContainerV1(key, "baker_apron", 1);
    assert.equal(stored, 1);
    assert.equal(countInContainer(key, "baker_apron"), 1);
    assert.equal(harthmereInventoryCountByItemIdV141("baker_apron"), 0);
  });

  it("Take All empties the container into the inventory", () => {
    const entityId = 4245 as BiomesId;
    const { key } = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", READY);
    takeAllFromHarthmereContainerV1(key);
    const record = readHarthmereContainerV1(key);
    assert.equal(record?.items.length, 0);
    assert.equal(harthmereInventoryCountByItemIdV141("baker_apron"), 1);
    assert.equal(harthmereInventoryCountByItemIdV141("field_trousers"), 1);
    assert.equal(harthmereInventoryCountByItemIdV141("cloth_scrap"), 4);
  });

  describe("Road Ahead clothing crate is quest-gated (right time)", () => {
    it("is EMPTY and locked before the gear-up step", () => {
      const entityId = 4250 as BiomesId;
      const record = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      assert.equal(record.items.length, 0, "no clothing before the right time");
      assert.equal(record.sealed, false);
      assert.ok(record.note, "shows a 'not yet' note");
      assert.equal(harthmereInventoryCountByItemIdV141("baker_apron"), 0);
    });

    it("fills with the outfit once the quest reaches the gear-up step", () => {
      const entityId = 4251 as BiomesId;
      // Player walks up early: empty + unsealed.
      const before = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      assert.equal(before.items.length, 0);
      // Quest advances; reopening now fills + seals.
      const after = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", {
        questClothingReady: true,
      });
      assert.equal(after.sealed, true);
      assert.equal(countInContainer(after.key, "baker_apron"), 1);
      assert.equal(countInContainer(after.key, "field_trousers"), 1);
    });

    it("does not re-grant the outfit after it has been taken (sealed)", () => {
      const entityId = 4252 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(
        entityId,
        "Clothing Crate",
        READY
      );
      takeAllFromHarthmereContainerV1(key);
      assert.equal(readHarthmereContainerV1(key)?.items.length, 0);
      // Re-open with the gate STILL open must not refill (player already got it).
      const reopened = getOrSeedHarthmereContainerV1(
        entityId,
        "Clothing Crate",
        READY
      );
      assert.equal(reopened.items.length, 0);
    });

    it("preserves items the player stored while it was still locked", () => {
      const entityId = 4253 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      // Give the player something and stash it in the locked crate.
      grantHarthmereItem("rough_stone", 2, "test setup");
      putIntoHarthmereContainerV1(key, "rough_stone", 2);
      assert.equal(countInContainer(key, "rough_stone"), 2);
      // Gate opens: the stored item survives alongside the new outfit.
      const filled = getOrSeedHarthmereContainerV1(entityId, "Clothing Crate", {
        questClothingReady: true,
      });
      assert.equal(filled.sealed, true);
      assert.equal(countInContainer(filled.key, "rough_stone"), 2);
      assert.equal(countInContainer(filled.key, "baker_apron"), 1);
    });
  });

  it("does not re-seed a container that was emptied (no infinite loot)", () => {
    const entityId = 4246 as BiomesId;
    const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Supply Box");
    takeAllFromHarthmereContainerV1(key);
    // Re-open: the key already exists, so it must stay empty.
    const reopened = getOrSeedHarthmereContainerV1(entityId, "Old Supply Box");
    assert.equal(reopened.items.length, 0);
  });

  // Universality: put/take works for ANY container, not just the quest crate.
  // Exercises a generic (non-clothing) crate, a toolbag, and a basket.
  for (const label of ["Dockside Storage Crate", "Worker's Toolbag", "Forage Basket"]) {
    it(`take OUT and put IN works for a generic container: ${label}`, () => {
      const entityId = (4260 + label.length) as BiomesId;
      const seeded = getOrSeedHarthmereContainerV1(entityId, label);
      // Generic containers seal immediately and start with their loot.
      assert.equal(seeded.sealed, true);
      assert.ok(seeded.items.length > 0, "generic container starts stocked");

      // Take the first stocked item OUT — it lands in the player inventory.
      const first = seeded.items[0];
      const invBefore = harthmereInventoryCountByItemIdV141(first.itemId);
      const taken = takeFromHarthmereContainerV1(seeded.key, first.itemId, 1);
      assert.equal(taken, 1);
      assert.equal(
        harthmereInventoryCountByItemIdV141(first.itemId),
        invBefore + 1
      );

      // Put it back IN — it leaves the player inventory and re-enters the crate.
      const storedBack = putIntoHarthmereContainerV1(seeded.key, first.itemId, 1);
      assert.equal(storedBack, 1);
      assert.equal(countInContainer(seeded.key, first.itemId), first.quantity);
      assert.equal(
        harthmereInventoryCountByItemIdV141(first.itemId),
        invBefore
      );
    });
  }

  // Integration of the drag/Enter DECISION (pure, from the interaction module)
  // with the EXECUTION (the container funcs). Mirrors the panel's executeTransfer:
  // resolve the action from the two sides, then move the WHOLE stack.
  describe("drag-and-drop / Enter move whole stacks", () => {
    function applyDrag(
      key: string,
      sourceSide: "container" | "inventory",
      targetSide: "container" | "inventory",
      itemId: string,
      containerItems: { itemId: string; quantity: number }[],
      inventoryQty: number
    ): number {
      const action = resolveHarthmereContainerTransferV1(sourceSide, targetSide);
      if (action === "take") {
        const item = containerItems.find((i) => i.itemId === itemId);
        return takeFromHarthmereContainerV1(key, itemId, item?.quantity ?? 1);
      }
      if (action === "store") {
        return putIntoHarthmereContainerV1(key, itemId, inventoryQty);
      }
      return 0;
    }

    it("dragging a container item onto the inventory takes the WHOLE stack", () => {
      const entityId = 4270 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Storage Bin");
      const items = readHarthmereContainerV1(key)!.items.map((s) => ({ ...s }));
      const stacked = items.find((i) => i.quantity > 1) ?? items[0];
      const before = harthmereInventoryCountByItemIdV141(stacked.itemId);
      const moved = applyDrag(
        key,
        "container",
        "inventory",
        stacked.itemId,
        items,
        0
      );
      assert.equal(moved, stacked.quantity);
      assert.equal(countInContainer(key, stacked.itemId), 0);
      assert.equal(
        harthmereInventoryCountByItemIdV141(stacked.itemId),
        before + stacked.quantity
      );
    });

    it("dragging an inventory item onto the container stores the WHOLE stack", () => {
      const entityId = 4271 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Storage Bin");
      grantHarthmereItem("iron_ore", 3, "test setup");
      const moved = applyDrag(key, "inventory", "container", "iron_ore", [], 3);
      assert.equal(moved, 3);
      assert.equal(countInContainer(key, "iron_ore"), 3);
      assert.equal(harthmereInventoryCountByItemIdV141("iron_ore"), 0);
    });

    it("a same-column drop moves nothing", () => {
      const entityId = 4272 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Storage Bin");
      const items = readHarthmereContainerV1(key)!.items.map((s) => ({ ...s }));
      const target = items[0];
      const movedC = applyDrag(
        key,
        "container",
        "container",
        target.itemId,
        items,
        0
      );
      grantHarthmereItem("iron_ore", 2, "test setup");
      const movedI = applyDrag(key, "inventory", "inventory", "iron_ore", [], 2);
      assert.equal(movedC, 0);
      assert.equal(movedI, 0);
      assert.equal(countInContainer(key, target.itemId), target.quantity);
      assert.equal(harthmereInventoryCountByItemIdV141("iron_ore"), 2);
    });

    it("Enter on a focused container item takes it; on an inventory item stores it", () => {
      const entityId = 4273 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Storage Bin");
      // Container item focused -> Enter resolves to 'take'.
      assert.equal(harthmereContainerEnterActionV1("container"), "take");
      const items = readHarthmereContainerV1(key)!.items.map((s) => ({ ...s }));
      const focused = items.find((i) => i.quantity > 1) ?? items[0];
      takeFromHarthmereContainerV1(key, focused.itemId, focused.quantity);
      assert.equal(countInContainer(key, focused.itemId), 0);
      assert.ok(
        harthmereInventoryCountByItemIdV141(focused.itemId) >= focused.quantity
      );

      // Inventory item focused -> Enter resolves to 'store'.
      assert.equal(harthmereContainerEnterActionV1("inventory"), "store");
      grantHarthmereItem("iron_ore", 5, "test setup");
      putIntoHarthmereContainerV1(key, "iron_ore", 5);
      assert.equal(countInContainer(key, "iron_ore"), 5);
      assert.equal(harthmereInventoryCountByItemIdV141("iron_ore"), 0);
    });

    it("a drag carrying a stale item id resolves to a no-op move (no crash)", () => {
      const entityId = 4274 as BiomesId;
      const { key } = getOrSeedHarthmereContainerV1(entityId, "Old Storage Bin");
      // Item not present in the container: take resolves to 0 moved.
      const moved = applyDrag(
        key,
        "container",
        "inventory",
        "does_not_exist_item",
        readHarthmereContainerV1(key)!.items,
        0
      );
      assert.equal(moved, 0);
    });
  });
});

void readHarthmereInventoryState;
