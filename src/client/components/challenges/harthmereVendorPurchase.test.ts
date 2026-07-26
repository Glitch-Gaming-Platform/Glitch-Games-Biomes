/// <reference types="mocha" />

import assert from "assert";

const memoryStore = new Map<string, string>();
const dispatchedEvents: any[] = [];
const listeners = new Map<string, Set<(event: any) => void>>();
const localStorageShim = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  clear: () => memoryStore.clear(),
};

if (typeof (globalThis as any).Event === "undefined") {
  (globalThis as any).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

const windowMock: any = {
  localStorage: localStorageShim,
  location: {
    href: "https://www.glitch.fun/games/test/play?install_id=vendor-test",
    search: "?install_id=vendor-test",
  },
  addEventListener: (type: string, listener: (event: any) => void) => {
    const current = listeners.get(type) ?? new Set();
    current.add(listener);
    listeners.set(type, current);
  },
  removeEventListener: (type: string, listener: (event: any) => void) => {
    listeners.get(type)?.delete(listener);
  },
  dispatchEvent: (event: any) => {
    dispatchedEvents.push(event);
    for (const listener of listeners.get(event.type) ?? []) {
      listener(event);
    }
    return true;
  },
  setInterval: () => 0,
  clearInterval: () => {},
};
(globalThis as any).window = windowMock;
(globalThis as any).localStorage = localStorageShim;

import {
  buyHarthmereVendorItemForTest,
  grantHarthmereItemLocallyForTest,
  harthmereInventoryCountByItemId,
  readHarthmereInventoryState,
  readHarthmereLiveInventoryItemCount,
  resetHarthmereLiveInventoryItemsSnapshotForTest,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { resetHarthmereLocalDevRapidActionGuards } from "@/client/components/challenges/LocalDevHarthmereEconomyHardening";
import { getHarthmereCurrentVendorStockLine } from "@/client/components/challenges/LocalDevHarthmereVendorCatalog";
import {
  markHarthmereLiveSnapshotSeen,
  resetHarthmereLiveSnapshotForTest,
} from "@/client/components/challenges/harthmereLiveAuthoritySignal";
import { HARTHMERE_LIVE_INVENTORY_SYNC_EVENT } from "@/client/components/challenges/harthmereEvents";

const ORCHARD_OFFSET = 63;
const ITEM_ID = "fresh_carrot";
const BUNDLE_QUANTITY = 6;

function liveResponse(input: {
  gold: number;
  itemCount: number;
  rejected?: string;
}) {
  return {
    ok: true,
    backendMutation: {
      applied: true,
      warnings: input.rejected ? [`vendor_rejected:${input.rejected}`] : [],
      touchedModels: input.rejected
        ? ["vendor_rejection"]
        : ["vendor_stock", "wallet", "inventory_items"],
    },
    inventoryLootState: {
      actor: {
        gold: input.gold,
        items: input.itemCount > 0 ? { [ITEM_ID]: input.itemCount } : {},
      },
    },
    playerStatusState: { gold: input.gold },
  };
}

describe("Harthmere universal vendor purchase transaction", () => {
  beforeEach(() => {
    (globalThis as any).window = windowMock;
    (globalThis as any).localStorage = localStorageShim;
    memoryStore.clear();
    dispatchedEvents.length = 0;
    listeners.clear();
    delete windowMock.fetch;
    resetHarthmereLiveSnapshotForTest();
    resetHarthmereLiveInventoryItemsSnapshotForTest();
    resetHarthmereLocalDevRapidActionGuards();
  });

  afterEach(() => {
    resetHarthmereLiveSnapshotForTest();
    resetHarthmereLiveInventoryItemsSnapshotForTest();
  });

  it("sends one authoritative bundle transaction and publishes the returned inventory", async () => {
    markHarthmereLiveSnapshotSeen();
    const calls: Array<{ input: unknown; init?: RequestInit }> = [];
    windowMock.fetch = async (input: unknown, init?: RequestInit) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        json: async () =>
          liveResponse({ gold: 71, itemCount: BUNDLE_QUANTITY }),
      } as Response;
    };

    await buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);

    assert.equal(calls.length, 1);
    const request = JSON.parse(String(calls[0].init?.body ?? "{}"));
    assert.equal(request.actionKind, "request_vendor_transaction");
    assert.equal(request.subsystem, "vendor");
    assert.deepEqual(request.payload, {
      vendorId: "orchard_produce_stand",
      transactionKind: "buy",
      itemId: ITEM_ID,
      count: BUNDLE_QUANTITY,
    });
    assert.equal(readHarthmereLiveInventoryItemCount(ITEM_ID), BUNDLE_QUANTITY);
    assert.equal(readHarthmereInventoryState().wallet.gold, 71);
    assert.equal(
      dispatchedEvents.some(
        (event) => event.type === HARTHMERE_LIVE_INVENTORY_SYNC_EVENT
      ),
      true
    );
    assert.equal(
      readHarthmereInventoryState().recent[0]?.action,
      "Bought Item"
    );
    assert.equal(
      getHarthmereCurrentVendorStockLine(ORCHARD_OFFSET, ITEM_ID)?.quantity,
      BUNDLE_QUANTITY
    );
  });

  it("keeps the listing and local inventory unchanged when authority rejects the buy", async () => {
    markHarthmereLiveSnapshotSeen();
    const before = readHarthmereInventoryState();
    windowMock.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          liveResponse({
            gold: before.wallet.gold,
            itemCount: 0,
            rejected: "insufficient_gold",
          }),
      } as Response);

    await buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);

    const after = readHarthmereInventoryState();
    assert.equal(harthmereInventoryCountByItemId(ITEM_ID), 0);
    assert.equal(after.wallet.gold, before.wallet.gold);
    assert.equal(after.recent[0]?.action, "Cannot Buy");
    assert.match(after.recent[0]?.detail ?? "", /enough gold/i);
    assert.equal(
      getHarthmereCurrentVendorStockLine(ORCHARD_OFFSET, ITEM_ID)?.quantity,
      BUNDLE_QUANTITY
    );
  });

  it("preserves the offer for every authority-owned purchase rejection", async () => {
    markHarthmereLiveSnapshotSeen();
    const cases = [
      ["vendor_out_of_stock", /out of stock/i],
      ["inventory_full", /inventory is full/i],
      [
        "insufficient_reputation_for_vendor_item",
        /reputation is not high enough/i,
      ],
      ["invalid_vendor_bundle_count", /displayed bundle/i],
    ] as const;

    for (const [rejection, expectedMessage] of cases) {
      resetHarthmereLocalDevRapidActionGuards();
      const gold = readHarthmereInventoryState().wallet.gold;
      windowMock.fetch = async () =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            liveResponse({ gold, itemCount: 0, rejected: rejection }),
        } as Response);

      await buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);

      const state = readHarthmereInventoryState();
      assert.equal(state.recent[0]?.action, "Cannot Buy");
      assert.match(state.recent[0]?.detail ?? "", expectedMessage);
      assert.equal(harthmereInventoryCountByItemId(ITEM_ID), 0);
      assert.equal(
        getHarthmereCurrentVendorStockLine(ORCHARD_OFFSET, ITEM_ID)?.quantity,
        BUNDLE_QUANTITY
      );
    }
  });

  it("keeps the listing and local inventory unchanged when confirmation is lost", async () => {
    markHarthmereLiveSnapshotSeen();
    const before = readHarthmereInventoryState();
    windowMock.fetch = async () => {
      throw new Error("network unavailable");
    };

    await buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);

    const after = readHarthmereInventoryState();
    assert.equal(harthmereInventoryCountByItemId(ITEM_ID), 0);
    assert.equal(after.wallet.gold, before.wallet.gold);
    assert.equal(after.recent[0]?.action, "Cannot Buy");
    assert.match(after.recent[0]?.detail ?? "", /not confirmed/i);
    assert.equal(
      getHarthmereCurrentVendorStockLine(ORCHARD_OFFSET, ITEM_ID)?.quantity,
      BUNDLE_QUANTITY
    );
  });

  it("deduplicates rapid live purchase activation", async () => {
    markHarthmereLiveSnapshotSeen();
    let release: (() => void) | undefined;
    let fetchCount = 0;
    windowMock.fetch = async () => {
      fetchCount += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        ok: true,
        status: 200,
        json: async () =>
          liveResponse({ gold: 71, itemCount: BUNDLE_QUANTITY }),
      } as Response;
    };

    const first = buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);
    const second = buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.equal(fetchCount, 1);
    release?.();
    await Promise.all([first, second]);
    assert.equal(fetchCount, 1);
  });

  it("adds exactly one bundle offline without consuming the catalogue listing", async () => {
    grantHarthmereItemLocallyForTest(ITEM_ID, 1, "existing stack");
    const beforeCount = harthmereInventoryCountByItemId(ITEM_ID);
    const beforeGold = readHarthmereInventoryState().wallet.gold;

    await buyHarthmereVendorItemForTest(ORCHARD_OFFSET, ITEM_ID);

    const after = readHarthmereInventoryState();
    assert.equal(
      harthmereInventoryCountByItemId(ITEM_ID),
      beforeCount + BUNDLE_QUANTITY
    );
    assert.ok(after.wallet.gold < beforeGold);
    assert.equal(after.recent[0]?.action, "Bought Item");
    assert.equal(
      getHarthmereCurrentVendorStockLine(ORCHARD_OFFSET, ITEM_ID)?.quantity,
      BUNDLE_QUANTITY
    );
  });
});
