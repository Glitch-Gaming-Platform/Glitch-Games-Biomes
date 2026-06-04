/// <reference types="mocha" />

import assert from "assert";

import {
  equippedHarthmereRepairToolItemIdV151,
  isHarthmereCleanupToolEquippedV151,
  isHarthmereCleanupToolItemIdV151,
  isHarthmereRepairToolEquippedV151,
  isHarthmereRepairToolItemIdV151,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

const stateWithMainHand = (itemId?: string) =>
  ({ equipment: itemId ? { main_hand: { itemId } } : {} } as any);

describe("HARTHMERE_REPAIR_TOOL_EQUIP_V151 — equipped repair tool detection", () => {
  it("recognizes the repair mallet item as a repair tool", () => {
    assert.equal(isHarthmereRepairToolItemIdV151("repair_mallet"), true);
  });

  it("does not treat a weapon or an unknown item as a repair tool", () => {
    assert.equal(isHarthmereRepairToolItemIdV151("iron_longsword"), false);
    assert.equal(isHarthmereRepairToolItemIdV151("not_an_item"), false);
    assert.equal(isHarthmereRepairToolItemIdV151(undefined), false);
  });

  it("reports the equipped repair tool id only when one is in the main hand", () => {
    assert.equal(
      equippedHarthmereRepairToolItemIdV151(stateWithMainHand("repair_mallet")),
      "repair_mallet"
    );
    assert.equal(
      equippedHarthmereRepairToolItemIdV151(stateWithMainHand("iron_longsword")),
      undefined
    );
    assert.equal(
      equippedHarthmereRepairToolItemIdV151(stateWithMainHand(undefined)),
      undefined
    );
  });

  it("isHarthmereRepairToolEquippedV151 is true only with a repair tool equipped", () => {
    assert.equal(
      isHarthmereRepairToolEquippedV151(stateWithMainHand("repair_mallet")),
      true
    );
    assert.equal(
      isHarthmereRepairToolEquippedV151(stateWithMainHand("woodsman_axe")),
      false
    );
    assert.equal(
      isHarthmereRepairToolEquippedV151(stateWithMainHand(undefined)),
      false
    );
  });

  it("detects the cleanup tool (muck rake) as its own action", () => {
    assert.equal(isHarthmereCleanupToolItemIdV151("muck_rake"), true);
    assert.equal(isHarthmereCleanupToolItemIdV151("repair_mallet"), false);
    assert.equal(
      isHarthmereCleanupToolEquippedV151(stateWithMainHand("muck_rake")),
      true
    );
    assert.equal(
      isHarthmereCleanupToolEquippedV151(stateWithMainHand("repair_mallet")),
      false
    );
    // A repair tool is not a cleanup tool and vice-versa.
    assert.equal(
      isHarthmereRepairToolEquippedV151(stateWithMainHand("muck_rake")),
      false
    );
  });
});
