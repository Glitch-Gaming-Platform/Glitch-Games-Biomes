import assert from "assert";
import {
  HARTHMERE_CARRY_WEIGHT_LIMIT_V1,
  HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1,
  harthmereCarryWeightOverageV1,
  harthmereEncumbranceStaminaMultiplierV1,
  harthmereInventoryCarryWeightV1,
  harthmereInventoryEncumbranceStaminaMultiplierV1,
  harthmereItemUnitWeightV1,
} from "../mmo_carry_weight_v1";

const EPS = 1e-9;

describe("mmo_carry_weight_v1 encumbrance", () => {
  it("computes pounds carried over the limit (0 at or under the limit)", () => {
    assert.equal(harthmereCarryWeightOverageV1(0), 0);
    assert.equal(harthmereCarryWeightOverageV1(10), 0);
    assert.equal(
      harthmereCarryWeightOverageV1(HARTHMERE_CARRY_WEIGHT_LIMIT_V1),
      0
    );
    assert.equal(
      harthmereCarryWeightOverageV1(HARTHMERE_CARRY_WEIGHT_LIMIT_V1 + 7),
      7
    );
    // Malformed weights are treated as 0 (never negative overage).
    assert.equal(harthmereCarryWeightOverageV1(Number.NaN), 0);
  });

  it("applies no stamina penalty at or under the carry-weight limit", () => {
    assert.equal(harthmereEncumbranceStaminaMultiplierV1(0), 1);
    assert.equal(harthmereEncumbranceStaminaMultiplierV1(10), 1);
    assert.equal(
      harthmereEncumbranceStaminaMultiplierV1(HARTHMERE_CARRY_WEIGHT_LIMIT_V1),
      1
    );
  });

  it("drains stamina by the per-pound factor for the first pound over the limit", () => {
    assert.ok(
      Math.abs(
        harthmereEncumbranceStaminaMultiplierV1(
          HARTHMERE_CARRY_WEIGHT_LIMIT_V1 + 1
        ) - HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1
      ) < EPS
    );
  });

  it("compounds the per-pound penalty for every additional pound over", () => {
    // FACTOR ^ poundsOver for 2, 5, and 10 pounds over the limit.
    for (const over of [2, 5, 10]) {
      assert.ok(
        Math.abs(
          harthmereEncumbranceStaminaMultiplierV1(
            HARTHMERE_CARRY_WEIGHT_LIMIT_V1 + over
          ) -
            Math.pow(
              HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1,
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
        harthmereEncumbranceStaminaMultiplierV1(
          HARTHMERE_CARRY_WEIGHT_LIMIT_V1 + 0.5
        ) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1, 0.5)
      ) < EPS
    );
  });

  it("honors a custom carry-weight limit", () => {
    // With a 10 lb limit, 13 lb carried is 3 lb over.
    assert.ok(
      Math.abs(
        harthmereEncumbranceStaminaMultiplierV1(13, 10) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1, 3)
      ) < EPS
    );
  });

  it("derives the multiplier directly from an inventory map", () => {
    // steel_sword weighs 5 lb each (tools); 6 = 30 lb = 5 over the 25 lb limit.
    assert.equal(harthmereItemUnitWeightV1("steel_sword"), 5);
    const inventory = { steel_sword: 6 };
    assert.equal(harthmereInventoryCarryWeightV1(inventory), 30);
    assert.ok(
      Math.abs(
        harthmereInventoryEncumbranceStaminaMultiplierV1(inventory) -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1, 5)
      ) < EPS
    );

    // A light inventory under the limit incurs no penalty.
    assert.equal(
      harthmereInventoryEncumbranceStaminaMultiplierV1({ steel_sword: 1 }),
      1
    );
  });
});
