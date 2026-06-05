// HARTHMERE_GATHERING_NODE_WORLD_INTERACTION_V1:
// Locks in the in-world harvest loop the F-prompt drives:
//  - a node is only offered when the player is within interaction range,
//  - harvesting is gated on the required tool (the screenshot's "requires the
//    correct gathering tool" case), and
//  - once the tool is held, F grants the node's yield into the inventory and
//    the node goes on cooldown (no infinite farming).
import assert from "assert";

// Minimal browser shim so the localStorage-backed gathering + inventory modules
// run under node. Must be installed before importing the modules.
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

import { grantHarthmereItem } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { harthmereInventoryCountByItemIdV141 } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_GATHERING_NODE_WORLD_TARGETS_V1,
  harthmereGatheringNodeIdForObjectLabelV1,
  nearestHarthmereGatheringNodePromptV1,
  performHarthmereGather,
  readHarthmereGatheringState,
  writeHarthmereGatheringState,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";

// The first authored mining node — a stable anchor for the geometry assertions.
const IRON_VEIN_ID = "harthmere_north_iron_vein";

function ironVein() {
  const target = HARTHMERE_GATHERING_NODE_WORLD_TARGETS_V1.find(
    (t) => t.id === IRON_VEIN_ID
  );
  assert(target, "expected the iron vein node target to exist");
  return target;
}

describe("harthmere gathering node world interaction", () => {
  beforeEach(() => {
    // Re-point the global window at this file's mock. When several browser-shim
    // test files run in one mocha process they each clobber globalThis.window;
    // re-asserting here keeps the module's localStorage reads on our own store.
    (globalThis as unknown as { window: unknown }).window = windowMock;
    localStorageMock.clear();
  });

  it("offers the nearest node only inside interaction range", () => {
    const node = ironVein();
    const [x, y, z] = node.position;
    const onTop = nearestHarthmereGatheringNodePromptV1({ x, y, z });
    assert.equal(onTop?.id, IRON_VEIN_ID);
    assert.ok((onTop?.distance ?? Infinity) < 0.01);

    // Far away (1000 blocks east) → no prompt.
    const farAway = nearestHarthmereGatheringNodePromptV1({
      x: x + 1000,
      y,
      z,
    });
    assert.equal(farAway, undefined);
  });

  it("resolves the screenshot harvest labels to real gathering nodes", () => {
    assert.equal(
      harthmereGatheringNodeIdForObjectLabelV1("Orchard Softwood Branches"),
      "harthmere_orchard_softwood"
    );
    assert.equal(
      harthmereGatheringNodeIdForObjectLabelV1("Boar Sounder Harvest"),
      "boar_sounder_harvest"
    );
  });

  it("offers F prompts at the screenshot harvest node positions", () => {
    const orchard = nearestHarthmereGatheringNodePromptV1({
      x: 468,
      y: 53,
      z: -118,
    });
    assert.equal(orchard?.id, "harthmere_orchard_softwood");

    const boar = nearestHarthmereGatheringNodePromptV1({
      x: 404,
      y: 53,
      z: -414,
    });
    assert.equal(boar?.id, "boar_sounder_harvest");
  });

  it("blocks harvesting without the required tool and names the tool", () => {
    const result = performHarthmereGather(IRON_VEIN_ID, {
      ignoreCooldown: true,
    });
    assert.equal(result.ok, false);
    // The gate fires and the feedback names the missing tool requirement — this
    // is the screenshot's "requires the correct gathering tool" case, the reason
    // pressing F felt like "nothing happened" before the prompt surfaced it.
    assert.match(result.message ?? "", /tool/i);
    // Nothing entered the inventory.
    assert.equal(harthmereInventoryCountByItemIdV141("iron_ore"), 0);
  });

  it("grants the node yield into the inventory once the tool is held", () => {
    grantHarthmereItem("rusty_pickaxe", 1, "test setup");
    const result = performHarthmereGather(IRON_VEIN_ID, {
      ignoreCooldown: true,
    });
    assert.equal(result.ok, true);
    // baseYield guarantees at least 2 iron_ore and 1 rough_stone.
    assert.ok(harthmereInventoryCountByItemIdV141("iron_ore") >= 2);
    assert.ok(harthmereInventoryCountByItemIdV141("rough_stone") >= 1);
  });

  it("harvests the orchard softwood branches when the axe is held", () => {
    grantHarthmereItem("woodcutters_axe", 1, "test setup");
    const result = performHarthmereGather("harthmere_orchard_softwood", {
      ignoreCooldown: true,
    });
    assert.equal(result.ok, true);
    assert.ok(harthmereInventoryCountByItemIdV141("softwood_log") >= 2);
    assert.ok(harthmereInventoryCountByItemIdV141("oak_branch") >= 1);
  });

  it("harvests the boar sounder once skinning requirements are met", () => {
    grantHarthmereItem("skinning_knife", 1, "test setup");
    const state = readHarthmereGatheringState();
    writeHarthmereGatheringState({
      ...state,
      professions: {
        ...state.professions,
        skinning: { ...state.professions.skinning, level: 2 },
      },
    });

    const result = performHarthmereGather("boar_sounder_harvest", {
      ignoreCooldown: true,
    });
    assert.equal(result.ok, true);
    assert.ok(harthmereInventoryCountByItemIdV141("boar_hide") >= 1);
    assert.ok(harthmereInventoryCountByItemIdV141("raw_meat") >= 1);
  });

  it("puts a freshly gathered node on cooldown (no infinite farming)", () => {
    grantHarthmereItem("rusty_pickaxe", 1, "test setup");
    const first = performHarthmereGather(IRON_VEIN_ID);
    assert.equal(first.ok, true);
    // Immediate re-harvest without ignoreCooldown is depleted.
    const second = performHarthmereGather(IRON_VEIN_ID);
    assert.equal(second.ok, false);
    assert.match(second.message ?? "", /depleted/i);
  });
});
