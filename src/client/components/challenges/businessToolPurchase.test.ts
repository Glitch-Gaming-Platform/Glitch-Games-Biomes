/// <reference types="mocha" />
import assert from "assert";

// Drive the REAL client purchase against a localStorage-backed inventory store
// (not just the pure decision core): clicking Buy must take the player's gold
// (or refuse + tell them when they can't afford it) and the tool must actually
// land in their inventory. We shim window.localStorage so the store persists.
const memoryStore = new Map<string, string>();
const localStorageShim = {
  getItem: (key: string) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
  setItem: (key: string, value: string) => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  clear: () => memoryStore.clear(),
};
(globalThis as any).window = {
  localStorage: localStorageShim,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).localStorage = localStorageShim;
if (typeof (globalThis as any).Event === "undefined") {
  (globalThis as any).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

// Import AFTER the shim is installed so module-level reads see a browser-like env.
import {
  harthmereJobToolOwnedStateV151,
  purchaseHarthmereBusinessToolV151,
  readHarthmereInventoryState,
  writeHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

function setGold(gold: number) {
  const state = readHarthmereInventoryState();
  writeHarthmereInventoryState({
    ...state,
    wallet: { ...state.wallet, gold },
  });
}

function ownsRepairMallet(): boolean {
  return readHarthmereInventoryState().backpack.items.some(
    (item) => item.itemId === "repair_mallet"
  );
}

describe("purchaseHarthmereBusinessToolV151 — money out, tool in (real store)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("takes the player's gold and puts the tool in their inventory", () => {
    setGold(100);
    assert.equal(ownsRepairMallet(), false);
    assert.equal(harthmereJobToolOwnedStateV151().repairToolOwned, false);

    const result = purchaseHarthmereBusinessToolV151("repair_maintenance_person");
    assert.equal(result.ok, true);
    assert.equal(result.toolItemId, "repair_mallet");

    // Repair Mallet costs 30 gold.
    assert.equal(readHarthmereInventoryState().wallet.gold, 70);
    assert.equal(ownsRepairMallet(), true);
    assert.equal(harthmereJobToolOwnedStateV151().repairToolOwned, true);
  });

  it("refuses and does NOT take gold when the player can't afford it", () => {
    setGold(5);
    const result = purchaseHarthmereBusinessToolV151("repair_maintenance_person");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "insufficient_gold");

    // Gold untouched, no tool granted.
    assert.equal(readHarthmereInventoryState().wallet.gold, 5);
    assert.equal(ownsRepairMallet(), false);

    // And the player is told why (a "Cannot Buy ... costs 30 gold" log entry).
    const logs = (readHarthmereInventoryState() as any).recent ?? [];
    assert.ok(
      logs.some((entry: any) =>
        /costs 30 gold/i.test(`${entry?.action ?? ""} ${entry?.detail ?? ""}`)
      ),
      "expected a 'Cannot Buy ... costs 30 gold' message"
    );
  });

  it("refuses a second purchase once the player already owns the tool (gold kept)", () => {
    setGold(100);
    assert.equal(purchaseHarthmereBusinessToolV151("repair_maintenance_person").ok, true);
    assert.equal(readHarthmereInventoryState().wallet.gold, 70);

    const second = purchaseHarthmereBusinessToolV151("repair_maintenance_person");
    assert.equal(second.ok, false);
    assert.equal(second.reason, "already_owned");
    // No double charge.
    assert.equal(readHarthmereInventoryState().wallet.gold, 70);
  });

  it("sells the cleanup shop's Muck Rake the same way", () => {
    setGold(100);
    const result = purchaseHarthmereBusinessToolV151("waste_sanitation_cleanup");
    assert.equal(result.ok, true);
    assert.equal(result.toolItemId, "muck_rake");
    assert.equal(readHarthmereInventoryState().wallet.gold, 70);
    assert.equal(harthmereJobToolOwnedStateV151().cleanupToolOwned, true);
  });
});
