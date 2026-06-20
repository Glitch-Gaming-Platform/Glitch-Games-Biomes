import assert from "assert";
import {
  HARTHMERE_CARRY_WEIGHT_LIMIT,
  HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB,
  harthmereCarryWeightOverage,
  harthmereEncumbranceStaminaMultiplier,
  harthmereInventoryCarryWeight,
  harthmereInventoryEncumbranceStaminaMultiplier,
  harthmereItemUnitWeight,
} from "../mmo_carry_weight";

const EPS = 1e-9;

describe("mmo_carry_weight encumbrance", () => {
  it("computes pounds carried over the limit (0 at or under the limit)", () => {
    assert.equal(harthmereCarryWeightOverage(0), 0);
    assert.equal(harthmereCarryWeightOverage(10), 0);
    assert.equal(
      harthmereCarryWeightOverage(HARTHMERE_CARRY_WEIGHT_LIMIT),
      0
    );
    assert.equal(
      harthmereCarryWeightOverage(HARTHMERE_CARRY_WEIGHT_LIMIT + 7),
      7
    );
    // Malformed weights are treated as 0 (never negative overage).
    assert.equal(harthmereCarryWeightOverage(Number.NaN), 0);
  });

  it("applies no stamina penalty at or under the carry-weight limit", () => {
    assert.equal(harthmereEncumbranceStaminaMultiplier(0), 1);
    assert.equal(harthmereEncumbranceStaminaMultiplier(10), 1);
    assert.equal(
      harthmereEncumbranceStaminaMultiplier(HARTHMERE_CARRY_WEIGHT_LIMIT),
      1
    );
  });

  it("drains stamina by the per-pound factor for the first pound over the limit", () => {
    assert.ok(
      Math.abs(
        harthmereEncumbranceStaminaMultiplier(
          HARTHMERE_CARRY_WEIGHT_LIMIT + 1
        ) - HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB
      ) < EPS
    );
  });

  it("compounds the per-pound penalty for every additional pound over", () => {
    // FACTOR ^ poundsOver for 2, 5, and 10 pounds over the limit.
    for (const over of [2, 5, 10]) {
      assert.ok(
        Math.abs(
          harthmereEncumbranceStaminaMultiplier(
            HARTHMERE_CARRY_WEIGHT_LIMIT + over
          ) -
            Math.pow(
              HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB,
              over
            )
        ) < EPS,
        `multiplier mismatch at ${over} lb over`
      );
    }
  });

  it("supports fractional overage", () => {
    assert.ok(
      Math.abs(
        harthmereEncumbranceStaminaMultiplier(
          HARTHMERE_CARRY_WEIGHT_LIMIT + 0.5
        ) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB, 0.5)
      ) < EPS
    );
  });

  it("honors a custom carry-weight limit", () => {
    // With a 10 lb limit, 13 lb carried is 3 lb over.
    assert.ok(
      Math.abs(
        harthmereEncumbranceStaminaMultiplier(13, 10) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB, 3)
      ) < EPS
    );
  });

  it("derives the multiplier directly from an inventory map", () => {
    // steel_sword weighs 5 lb each (tools); 6 = 30 lb = 5 over the 25 lb limit.
    assert.equal(harthmereItemUnitWeight("steel_sword"), 5);
    const inventory = { steel_sword: 6 };
    assert.equal(harthmereInventoryCarryWeight(inventory), 30);
    assert.ok(
      Math.abs(
        harthmereInventoryEncumbranceStaminaMultiplier(inventory) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB, 5)
      ) < EPS
    );

    // A light inventory under the limit incurs no penalty.
    assert.equal(
      harthmereInventoryEncumbranceStaminaMultiplier({ steel_sword: 1 }),
      1
    );
  });
});
