/// <reference types="mocha" />

import assert from "assert";

import {
  equippedHarthmereRepairToolItemId,
  isHarthmereCleanupToolEquipped,
  isHarthmereCleanupToolItemId,
  isHarthmereRepairToolEquipped,
  isHarthmereRepairToolItemId,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

const stateWithMainHand = (itemId?: string) =>
  ({ equipment: itemId ? { main_hand: { itemId } } : {} } as any);

describe("HARTHMERE_REPAIR_TOOL_EQUIP — equipped repair tool detection", () => {
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
});
