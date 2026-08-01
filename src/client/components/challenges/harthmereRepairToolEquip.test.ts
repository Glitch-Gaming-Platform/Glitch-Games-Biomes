/// <reference types="mocha" />

import assert from "assert";

import {
  equippedHarthmereRepairToolItemId,
  harthmereOwnsFishingRod,
  isHarthmereCleanupToolEquipped,
  isHarthmereCleanupToolItemId,
  isHarthmereRepairToolEquipped,
  isHarthmereRepairToolItemId,
  recordHarthmereLiveInventoryItemsSnapshot,
  resetHarthmereLiveInventoryItemsSnapshotForTest,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  markHarthmereLiveSnapshotSeen,
  resetHarthmereLiveSnapshotForTest,
} from "@/client/components/challenges/harthmereLiveAuthoritySignal";

const stateWithMainHand = (itemId?: string) =>
  ({ equipment: itemId ? { main_hand: { itemId } } : {} } as any);

describe("HARTHMERE_REPAIR_TOOL_EQUIP — equipped repair tool detection", () => {
  beforeEach(() => {
    resetHarthmereLiveInventoryItemsSnapshotForTest();
    resetHarthmereLiveSnapshotForTest();
  });

  it("recognizes the repair mallet item as a repair tool", () => {
    assert.equal(isHarthmereRepairToolItemId("repair_mallet"), true);
  });

  it("does not treat a weapon or an unknown item as a repair tool", () => {
    assert.equal(isHarthmereRepairToolItemId("iron_longsword"), false);
    assert.equal(isHarthmereRepairToolItemId("not_an_item"), false);
    assert.equal(isHarthmereRepairToolItemId(undefined), false);
  });

  it("reports the equipped repair tool id only when one is in the main hand", () => {
    assert.equal(
      equippedHarthmereRepairToolItemId(stateWithMainHand("repair_mallet")),
      "repair_mallet"
    );
    assert.equal(
      equippedHarthmereRepairToolItemId(stateWithMainHand("iron_longsword")),
      undefined
    );
    assert.equal(
      equippedHarthmereRepairToolItemId(stateWithMainHand(undefined)),
      undefined
    );
  });

  it("isHarthmereRepairToolEquipped is true only with a repair tool equipped", () => {
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand("repair_mallet")),
      true
    );
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand("woodsman_axe")),
      false
    );
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand(undefined)),
      false
    );
  });

  it("detects the cleanup tool (muck rake) as its own action", () => {
    assert.equal(isHarthmereCleanupToolItemId("muck_rake"), true);
    assert.equal(isHarthmereCleanupToolItemId("repair_mallet"), false);
    assert.equal(
      isHarthmereCleanupToolEquipped(stateWithMainHand("muck_rake")),
      true
    );
    assert.equal(
      isHarthmereCleanupToolEquipped(stateWithMainHand("repair_mallet")),
      false
    );
    // A repair tool is not a cleanup tool and vice-versa.
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand("muck_rake")),
      false
    );
  });

  it("uses server-reported native equipment in live-authoritative sessions", () => {
    markHarthmereLiveSnapshotSeen();
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: {
          items: { repair_mallet: 1 },
          equipment: { main_hand: "repair_mallet" },
        },
      },
    });
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand(undefined)),
      true
    );
    assert.equal(
      isHarthmereCleanupToolEquipped(stateWithMainHand("muck_rake")),
      false
    );

    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: {
          items: { muck_rake: 1 },
          equipment: { main_hand: "muck_rake" },
        },
      },
    });
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand("repair_mallet")),
      false
    );
    assert.equal(
      isHarthmereCleanupToolEquipped(stateWithMainHand(undefined)),
      true
    );

    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: { actor: { items: {}, equipment: {} } },
    });
    assert.equal(
      isHarthmereRepairToolEquipped(stateWithMainHand("repair_mallet")),
      false,
      "an authoritative unequip must not fall back to stale local equipment"
    );
  });

  it("recognizes the HAR Training Rod in the authoritative live inventory", () => {
    markHarthmereLiveSnapshotSeen();
    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: {
          items: { "b:5920729553733598": 1 },
          equipment: {},
        },
      },
    });
    assert.equal(harthmereOwnsFishingRod(stateWithMainHand(undefined)), true);

    recordHarthmereLiveInventoryItemsSnapshot({
      inventoryLootState: {
        actor: { items: { rusty_pickaxe: 1 }, equipment: {} },
      },
    });
    assert.equal(harthmereOwnsFishingRod(stateWithMainHand(undefined)), false);
  });
});
