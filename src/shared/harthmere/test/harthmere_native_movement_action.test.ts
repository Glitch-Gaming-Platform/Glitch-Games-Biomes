import { TriggerState } from "@/shared/ecs/gen/components";
import {
  HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY,
  HARTHMERE_MOVEMENT_ACTION_RECEIPT_ROOT,
  applyHarthmereMovementActionStaminaReceipt,
  hasHarthmereMovementActionReceipt,
} from "@/shared/harthmere/harthmere_native_movement_action";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import assert from "assert";

describe("native movement-action stamina receipts", () => {
  it("charges one unique action exactly once across Sync and REST fallback", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, { stamina: 20, maxStamina: 20 });

    const first = applyHarthmereMovementActionStaminaReceipt(state, {
      action: "dodge",
      nonce: 101,
      alive: true,
    });
    const duplicate = applyHarthmereMovementActionStaminaReceipt(state, {
      action: "dodge",
      nonce: 101,
      alive: true,
    });

    assert.deepEqual(first, {
      accepted: true,
      duplicate: false,
      stamina: 17,
      maxStamina: 20,
    });
    assert.deepEqual(duplicate, {
      accepted: true,
      duplicate: true,
      stamina: 17,
      maxStamina: 20,
    });
    assert.equal(hasHarthmereMovementActionReceipt(state, 101), true);
    assert.equal(readHarthmereNativeVitals(state).stamina, 17);
  });

  it("rejects dead or exhausted actors without recording a receipt", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, { stamina: 1, maxStamina: 20 });

    assert.equal(
      applyHarthmereMovementActionStaminaReceipt(state, {
        action: "evade",
        nonce: 201,
        alive: false,
      }).accepted,
      false
    );
    assert.equal(
      applyHarthmereMovementActionStaminaReceipt(state, {
        action: "doubleJump",
        nonce: 202,
        alive: true,
      }).accepted,
      false
    );
    assert.equal(hasHarthmereMovementActionReceipt(state, 201), false);
    assert.equal(hasHarthmereMovementActionReceipt(state, 202), false);
    assert.equal(readHarthmereNativeVitals(state).stamina, 1);
  });

  it("keeps the dedupe journal bounded", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, { stamina: 1_000, maxStamina: 1_000 });
    for (let nonce = 1; nonce <= 100; nonce += 1) {
      assert.equal(
        applyHarthmereMovementActionStaminaReceipt(state, {
          action: "evade",
          nonce,
          alive: true,
        }).accepted,
        true
      );
    }
    assert.ok(
      (state.by_root.get(HARTHMERE_MOVEMENT_ACTION_RECEIPT_ROOT)?.size ?? 0) <=
        HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY + 1
    );
    assert.equal(hasHarthmereMovementActionReceipt(state, 100), true);
  });
});
