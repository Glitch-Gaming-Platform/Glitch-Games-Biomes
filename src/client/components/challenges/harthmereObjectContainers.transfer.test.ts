// HARTHMERE_OBJECT_CONTAINER_UI:
// Verifies that world-object containers behave like a real inventory: opening
// seeds them from the loot table, items can be taken into the player inventory
// and stored back, and an emptied container is NOT re-seeded on re-open.
import assert from "assert";

// A minimal browser shim so the localStorage-backed container + inventory
// modules run under node. Must be installed before importing the modules.
const store: Record<string, string> = {};
const sessionStore: Record<string, string> = {};
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
const sessionStorageMock = {
  getItem: (k: string) => (k in sessionStore ? sessionStore[k] : null),
  setItem: (k: string, v: string) => {
    sessionStore[k] = String(v);
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
  },
  clear: () => {
    for (const k of Object.keys(sessionStore)) {
      delete sessionStore[k];
    }
  },
};
const windowMock = {
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
  location: {
    href: "https://www.glitch.fun/games/test/play?install_id=test-install",
    search: "?install_id=test-install",
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
};
(globalThis as unknown as { window: unknown }).window = windowMock;

const TEST_USER_SCOPE = "container-test-user";

import {
  grantHarthmereItem,
  harthmereInventoryCountByItemId,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY,
  fillKnownRoadAheadClothingCrates,
  getOrSeedHarthmereContainer,
  normalizeHarthmereContainerKey,
  putIntoHarthmereContainer,
  readHarthmereContainer,
  takeAllFromHarthmereContainer,
  takeFromHarthmereContainer,
} from "@/client/components/challenges/harthmereObjectContainers";
import { setHarthmereLocalDevUserScope } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  harthmereContainerEnterAction,
  resolveHarthmereContainerTransfer,
} from "@/client/components/challenges/harthmereContainerTransferInteraction";
import {
  ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID,
  ROAD_AHEAD_CLOTHING_STOCK_STEP_ID,
  ROAD_AHEAD_MISSION_ID,
  ROAD_AHEAD_MISSION_STATE_KEY,
  ROAD_AHEAD_STEP_ORDER,
} from "@/client/components/challenges/harthmereRoadAheadClothingGate";
import type { BiomesId } from "@/shared/ids";

function countInContainer(key: string, itemId: string): number {
  const record = readHarthmereContainer(key);
  if (!record) {
    return 0;
  }
  return record.items
    .filter((slot) => slot.itemId === itemId)
    .reduce((sum, slot) => sum + slot.quantity, 0);
}

function writeRoadAheadStockedMissionState() {
  const stockIndex = ROAD_AHEAD_STEP_ORDER.indexOf(
    ROAD_AHEAD_CLOTHING_STOCK_STEP_ID
  );
  localStorageMock.setItem(
    ROAD_AHEAD_MISSION_STATE_KEY,
    JSON.stringify({
      accepted: true,
      active: { [ROAD_AHEAD_MISSION_ID]: stockIndex },
      completed: [],
      currentStepIndex: stockIndex,
      completedStepIds: [ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID],
    })
  );
}

function writeLegacySealedContainerRecord(
  entityId: BiomesId,
  label: string,
  items: { itemId: string; quantity: number }[]
): string {
  const key = normalizeHarthmereContainerKey(entityId, label);
  localStorageMock.setItem(
    `${HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY}.user.${TEST_USER_SCOPE}`,
    JSON.stringify({
      [key]: {
        key,
        label,
        items,
        sealed: true,
      },
    })
  );
  return key;
}

describe("harthmere object container take/store interface", () => {
  beforeEach(() => {
    // Re-point the global window at this file's mock; see the matching note in
    // harthmereGatheringNodeWorldInteraction.test.ts.
    (globalThis as unknown as { window: unknown }).window = windowMock;
    localStorageMock.clear();
    sessionStorageMock.clear();
    delete (windowMock as typeof windowMock & { fetch?: unknown }).fetch;
    setHarthmereLocalDevUserScope(TEST_USER_SCOPE);
  });

  // The Road Ahead clothing only appears once the quest reaches the
  // Billy/Muckwad handoff; pass questClothingReady so these transfer tests
  // exercise the filled crate.
  const READY = { questClothingReady: true } as const;

  it("seeds the Clothing Crate with both clothing halves for The Road Ahead", () => {
    const entityId = 4242 as BiomesId;
    const record = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    assert.equal(countInContainer(record.key, "baker_apron"), 1);
    assert.equal(countInContainer(record.key, "field_trousers"), 1);
    assert.equal(countInContainer(record.key, "cloth_scrap"), 4);
  });

  it("moves an item from the container into the player inventory on Take", () => {
    const entityId = 4243 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    const before = harthmereInventoryCountByItemId("baker_apron");
    const taken = takeFromHarthmereContainer(key, "baker_apron", 1);
    assert.equal(taken, 1);
    assert.equal(countInContainer(key, "baker_apron"), 0);
    assert.equal(harthmereInventoryCountByItemId("baker_apron"), before + 1);
  });

  it("rolls a live transfer back when the server rejects the inventory grant", async () => {
    const entityId = 4244 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    const inventoryBefore = harthmereInventoryCountByItemId("baker_apron");
    (windowMock as typeof windowMock & { fetch: typeof fetch }).fetch =
      async () =>
        ({
          ok: false,
          status: 409,
          json: async () => ({ ok: false, error: "rejected" }),
        } as Response);

    assert.equal(takeFromHarthmereContainer(key, "baker_apron", 1), 1);
    assert.equal(countInContainer(key, "baker_apron"), 1);
    assert.equal(
      harthmereInventoryCountByItemId("baker_apron"),
      inventoryBefore
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(countInContainer(key, "baker_apron"), 1);
    assert.equal(
      harthmereInventoryCountByItemId("baker_apron"),
      inventoryBefore
    );
  });

  it("deduplicates an in-flight live Take and commits only after confirmation", async () => {
    const entityId = 4245 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    const inventoryBefore = harthmereInventoryCountByItemId("baker_apron");
    let confirm: (() => void) | undefined;
    (windowMock as typeof windowMock & { fetch: typeof fetch }).fetch =
      async () => {
        await new Promise<void>((resolve) => {
          confirm = resolve;
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      };

    assert.equal(takeFromHarthmereContainer(key, "baker_apron", 1), 1);
    assert.equal(takeFromHarthmereContainer(key, "baker_apron", 1), 0);
    assert.equal(countInContainer(key, "baker_apron"), 1);
    assert.equal(
      harthmereInventoryCountByItemId("baker_apron"),
      inventoryBefore
    );

    confirm?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(countInContainer(key, "baker_apron"), 0);
    assert.equal(
      harthmereInventoryCountByItemId("baker_apron"),
      inventoryBefore + 1
    );
  });

  it("keeps container contents isolated by cloud-save user scope", () => {
    const entityId = 42431 as BiomesId;
    const label = "Old Supply Box";
    setHarthmereLocalDevUserScope("container-user-a");
    const firstUser = getOrSeedHarthmereContainer(entityId, label);
    takeAllFromHarthmereContainer(firstUser.key);
    assert.equal(countInContainer(firstUser.key, "road_ration"), 0);

    setHarthmereLocalDevUserScope("container-user-b");
    const secondUser = getOrSeedHarthmereContainer(entityId, label);
    assert.equal(
      countInContainer(secondUser.key, "road_ration"),
      1,
      "another player should see their own sealed quest/source container"
    );

    setHarthmereLocalDevUserScope("container-user-a");
    assert.equal(
      countInContainer(firstUser.key, "road_ration"),
      0,
      "returning to the first player should preserve that player's empty state"
    );
  });

  it("routes taken crafting materials into material storage instead of loose backpack slots", () => {
    const entityId = 42430 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(entityId, "Old Supply Box");
    const before = readHarthmereInventoryState();
    const beforeBackpackSlots = before.backpack.items.length;
    const beforeRoughStone = before.materialStorage.rough_stone ?? 0;

    const taken = takeFromHarthmereContainer(key, "rough_stone", 2);
    const after = readHarthmereInventoryState();

    assert.equal(taken, 2);
    assert.equal(countInContainer(key, "rough_stone"), 0);
    assert.equal(after.materialStorage.rough_stone, beforeRoughStone + 2);
    assert.equal(after.backpack.items.length, beforeBackpackSlots);
    assert.equal(
      after.backpack.items.some((item) => item.itemId === "rough_stone"),
      false
    );
    assert.match(after.recent[0]?.detail ?? "", /material storage/i);
  });

  it("stores a player item back into the container on Store", () => {
    const entityId = 4244 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    takeFromHarthmereContainer(key, "baker_apron", 1);
    assert.equal(harthmereInventoryCountByItemId("baker_apron"), 1);
    const stored = putIntoHarthmereContainer(key, "baker_apron", 1);
    assert.equal(stored, 1);
    assert.equal(countInContainer(key, "baker_apron"), 1);
    assert.equal(harthmereInventoryCountByItemId("baker_apron"), 0);
  });

  it("Take All empties the container into the inventory", () => {
    const entityId = 4245 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(
      entityId,
      "Clothing Crate",
      READY
    );
    takeAllFromHarthmereContainer(key);
    const record = readHarthmereContainer(key);
    assert.equal(record?.items.length, 0);
    assert.equal(harthmereInventoryCountByItemId("baker_apron"), 1);
    assert.equal(harthmereInventoryCountByItemId("field_trousers"), 1);
    assert.equal(harthmereInventoryCountByItemId("cloth_scrap"), 4);
  });

  describe("Road Ahead clothing crate is quest-gated (right time)", () => {
    it("is EMPTY and locked before the Billy/Muckwad handoff", () => {
      const entityId = 4250 as BiomesId;
      const record = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      assert.equal(record.items.length, 0, "no clothing before the right time");
      assert.equal(record.sealed, false);
      assert.ok(record.note, "shows a 'not yet' note");
      assert.equal(harthmereInventoryCountByItemId("baker_apron"), 0);
    });

    it("fills with the outfit once the quest reaches the clothing handoff", () => {
      const entityId = 4251 as BiomesId;
      // Player walks up early: empty + unsealed.
      const before = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      assert.equal(before.items.length, 0);
      // Quest advances; reopening now fills + seals.
      const after = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: true,
      });
      assert.equal(after.sealed, true);
      assert.equal(countInContainer(after.key, "baker_apron"), 1);
      assert.equal(countInContainer(after.key, "field_trousers"), 1);
    });

    it("fills an already-opened locked crate when the quest handoff completes", () => {
      const entityId = 4254 as BiomesId;
      const before = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      assert.equal(before.sealed, false);
      assert.equal(before.items.length, 0);

      const filled = fillKnownRoadAheadClothingCrates({
        questClothingReady: true,
      });

      assert.equal(filled.length, 1);
      assert.equal(filled[0].key, before.key);
      assert.equal(readHarthmereContainer(before.key)?.sealed, true);
      assert.equal(countInContainer(before.key, "baker_apron"), 1);
      assert.equal(countInContainer(before.key, "field_trousers"), 1);
    });

    it("seeds a first-open crate from the live Road Ahead mission state", () => {
      const entityId = 4255 as BiomesId;
      writeRoadAheadStockedMissionState();

      const record = getOrSeedHarthmereContainer(entityId, "Clothing Crate");

      assert.equal(record.sealed, true);
      assert.equal(countInContainer(record.key, "baker_apron"), 1);
      assert.equal(countInContainer(record.key, "field_trousers"), 1);
    });

    it("fills a locked crate from the live Road Ahead mission state", () => {
      const entityId = 4256 as BiomesId;
      const before = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      writeRoadAheadStockedMissionState();

      const filled = fillKnownRoadAheadClothingCrates();

      assert.equal(filled.length, 1);
      assert.equal(filled[0].key, before.key);
      assert.equal(countInContainer(before.key, "baker_apron"), 1);
      assert.equal(countInContainer(before.key, "field_trousers"), 1);
    });

    it("backfills a HAR-style legacy sealed clothing crate that only had old filler loot", () => {
      const entityId = 5165478204703095 as BiomesId;
      const key = writeLegacySealedContainerRecord(entityId, "Clothing Crate", [
        { itemId: "cloth_scrap", quantity: 1 },
      ]);

      const repaired = getOrSeedHarthmereContainer(
        entityId,
        "Clothing Crate",
        READY
      );

      assert.equal(repaired.key, key);
      assert.equal(repaired.sealed, true);
      assert.equal(countInContainer(key, "baker_apron"), 1);
      assert.equal(countInContainer(key, "field_trousers"), 1);
      assert.equal(
        countInContainer(key, "cloth_scrap"),
        1,
        "legacy filler is preserved without duplicating the new filler stack"
      );
    });

    it("backfills a HAR-style legacy sealed clothing crate that was already emptied", () => {
      const entityId = 5165478204703096 as BiomesId;
      const key = writeLegacySealedContainerRecord(
        entityId,
        "Clothing Crate",
        []
      );

      const repaired = getOrSeedHarthmereContainer(
        entityId,
        "Clothing Crate",
        READY
      );

      assert.equal(repaired.key, key);
      assert.equal(repaired.sealed, true);
      assert.equal(countInContainer(key, "baker_apron"), 1);
      assert.equal(countInContainer(key, "field_trousers"), 1);
    });

    it("repairs known sealed legacy clothing crates when the mission handoff completes", () => {
      const entityId = 4257 as BiomesId;
      const key = writeLegacySealedContainerRecord(entityId, "Clothing Crate", [
        { itemId: "cloth_scrap", quantity: 1 },
      ]);

      const filled = fillKnownRoadAheadClothingCrates({
        questClothingReady: true,
      });

      assert.equal(filled.length, 1);
      assert.equal(filled[0].key, key);
      assert.equal(countInContainer(key, "baker_apron"), 1);
      assert.equal(countInContainer(key, "field_trousers"), 1);
      assert.equal(countInContainer(key, "cloth_scrap"), 1);
    });

    it("adds a missing outfit half from a pre-fix sealed crate that only had one quest clothing item", () => {
      const entityId = 4258 as BiomesId;
      const key = writeLegacySealedContainerRecord(entityId, "Clothing Crate", [
        { itemId: "baker_apron", quantity: 1 },
        { itemId: "cloth_scrap", quantity: 1 },
      ]);

      const reopened = getOrSeedHarthmereContainer(
        entityId,
        "Clothing Crate",
        READY
      );

      assert.equal(reopened.key, key);
      assert.equal(countInContainer(key, "baker_apron"), 1);
      assert.equal(countInContainer(key, "field_trousers"), 1);
      assert.equal(countInContainer(key, "cloth_scrap"), 1);
    });

    it("does not re-grant the outfit after it has been taken (sealed)", () => {
      const entityId = 4252 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(
        entityId,
        "Clothing Crate",
        READY
      );
      takeAllFromHarthmereContainer(key);
      assert.equal(readHarthmereContainer(key)?.items.length, 0);
      // Re-open with the gate STILL open must not refill (player already got it).
      const reopened = getOrSeedHarthmereContainer(
        entityId,
        "Clothing Crate",
        READY
      );
      assert.equal(reopened.items.length, 0);
    });

    it("preserves items the player stored while it was still locked", () => {
      const entityId = 4253 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: false,
      });
      // Give the player something and stash it in the locked crate.
      grantHarthmereItem("rough_stone", 2, "test setup");
      putIntoHarthmereContainer(key, "rough_stone", 2);
      assert.equal(countInContainer(key, "rough_stone"), 2);
      // Gate opens: the stored item survives alongside the new outfit.
      const filled = getOrSeedHarthmereContainer(entityId, "Clothing Crate", {
        questClothingReady: true,
      });
      assert.equal(filled.sealed, true);
      assert.equal(countInContainer(filled.key, "rough_stone"), 2);
      assert.equal(countInContainer(filled.key, "baker_apron"), 1);
    });
  });

  it("does not re-seed a container that was emptied (no infinite loot)", () => {
    const entityId = 4246 as BiomesId;
    const { key } = getOrSeedHarthmereContainer(entityId, "Old Supply Box");
    takeAllFromHarthmereContainer(key);
    // Re-open: the key already exists, so it must stay empty.
    const reopened = getOrSeedHarthmereContainer(entityId, "Old Supply Box");
    assert.equal(reopened.items.length, 0);
  });

  // Universality: put/take works for ANY container, not just the quest crate.
  // Exercises a generic (non-clothing) crate, a toolbag, and a basket.
  for (const label of [
    "Dockside Storage Crate",
    "Worker's Toolbag",
    "Forage Basket",
  ]) {
    it(`take OUT and put IN works for a generic container: ${label}`, () => {
      const entityId = (4260 + label.length) as BiomesId;
      const seeded = getOrSeedHarthmereContainer(entityId, label);
      // Generic containers seal immediately and start with their loot.
      assert.equal(seeded.sealed, true);
      assert.ok(seeded.items.length > 0, "generic container starts stocked");

      // Take the first stocked item OUT — it lands in the player inventory.
      const first = seeded.items[0];
      const invBefore = harthmereInventoryCountByItemId(first.itemId);
      const taken = takeFromHarthmereContainer(seeded.key, first.itemId, 1);
      assert.equal(taken, 1);
      assert.equal(
        harthmereInventoryCountByItemId(first.itemId),
        invBefore + 1
      );

      // Put it back IN — it leaves the player inventory and re-enters the crate.
      const storedBack = putIntoHarthmereContainer(seeded.key, first.itemId, 1);
      assert.equal(storedBack, 1);
      assert.equal(countInContainer(seeded.key, first.itemId), first.quantity);
      assert.equal(harthmereInventoryCountByItemId(first.itemId), invBefore);
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
      const action = resolveHarthmereContainerTransfer(sourceSide, targetSide);
      if (action === "take") {
        const item = containerItems.find((i) => i.itemId === itemId);
        return takeFromHarthmereContainer(key, itemId, item?.quantity ?? 1);
      }
      if (action === "store") {
        return putIntoHarthmereContainer(key, itemId, inventoryQty);
      }
      return 0;
    }

    it("dragging a container item onto the inventory takes the WHOLE stack", () => {
      const entityId = 4270 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Old Storage Bin");
      const items = readHarthmereContainer(key)!.items.map((s) => ({ ...s }));
      const stacked = items.find((i) => i.quantity > 1) ?? items[0];
      const before = harthmereInventoryCountByItemId(stacked.itemId);
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
        harthmereInventoryCountByItemId(stacked.itemId),
        before + stacked.quantity
      );
    });

    it("dragging an inventory item onto the container stores the WHOLE stack", () => {
      const entityId = 4271 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Old Storage Bin");
      grantHarthmereItem("iron_ore", 3, "test setup");
      const moved = applyDrag(key, "inventory", "container", "iron_ore", [], 3);
      assert.equal(moved, 3);
      assert.equal(countInContainer(key, "iron_ore"), 3);
      assert.equal(harthmereInventoryCountByItemId("iron_ore"), 0);
    });

    it("a same-column drop moves nothing", () => {
      const entityId = 4272 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Old Storage Bin");
      const items = readHarthmereContainer(key)!.items.map((s) => ({ ...s }));
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
      const movedI = applyDrag(
        key,
        "inventory",
        "inventory",
        "iron_ore",
        [],
        2
      );
      assert.equal(movedC, 0);
      assert.equal(movedI, 0);
      assert.equal(countInContainer(key, target.itemId), target.quantity);
      assert.equal(harthmereInventoryCountByItemId("iron_ore"), 2);
    });

    it("Enter on a focused container item takes it; on an inventory item stores it", () => {
      const entityId = 4273 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Old Storage Bin");
      // Container item focused -> Enter resolves to 'take'.
      assert.equal(harthmereContainerEnterAction("container"), "take");
      const items = readHarthmereContainer(key)!.items.map((s) => ({ ...s }));
      const focused = items.find((i) => i.quantity > 1) ?? items[0];
      takeFromHarthmereContainer(key, focused.itemId, focused.quantity);
      assert.equal(countInContainer(key, focused.itemId), 0);
      assert.ok(
        harthmereInventoryCountByItemId(focused.itemId) >= focused.quantity
      );

      // Inventory item focused -> Enter resolves to 'store'.
      assert.equal(harthmereContainerEnterAction("inventory"), "store");
      grantHarthmereItem("iron_ore", 5, "test setup");
      putIntoHarthmereContainer(key, "iron_ore", 5);
      assert.equal(countInContainer(key, "iron_ore"), 5);
      assert.equal(harthmereInventoryCountByItemId("iron_ore"), 0);
    });

    it("a drag carrying a stale item id resolves to a no-op move (no crash)", () => {
      const entityId = 4274 as BiomesId;
      const { key } = getOrSeedHarthmereContainer(entityId, "Old Storage Bin");
      // Item not present in the container: take resolves to 0 moved.
      const moved = applyDrag(
        key,
        "container",
        "inventory",
        "does_not_exist_item",
        readHarthmereContainer(key)!.items,
        0
      );
      assert.equal(moved, 0);
    });
  });
});

void readHarthmereInventoryState;
