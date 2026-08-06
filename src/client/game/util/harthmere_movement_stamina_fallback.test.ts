import {
  confirmHarthmereMovementActionStamina,
  reconcileHarthmereMovementFallbackResponse,
  reconcileHarthmereMovementStaminaProjection,
  reserveHarthmereMovementStamina,
} from "@/client/game/util/harthmere_movement_stamina_fallback";
import assert from "assert";

function fallbackResponse(stamina: number, accepted = true) {
  return new Response(
    JSON.stringify({
      ok: true,
      action: "movement_action_fallback",
      mana: 100,
      maxMana: 100,
      stamina,
      maxStamina: 20,
      breath: 45,
      maxBreath: 45,
      hp: 100,
      maxHp: 100,
      damage: 0,
      accepted,
      duplicate: false,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("Harthmere movement stamina fallback", () => {
  it("reserves action costs against a stalled ECS observation", () => {
    const initial = reconcileHarthmereMovementStaminaProjection(undefined, {
      stamina: 14,
      maxStamina: 20,
    });
    const reserved = reserveHarthmereMovementStamina(initial, 3);
    const sameStaleEcs = reconcileHarthmereMovementStaminaProjection(reserved, {
      stamina: 14,
      maxStamina: 20,
    });
    assert.equal(sameStaleEcs.stamina, 11);

    const restored = reconcileHarthmereMovementStaminaProjection(sameStaleEcs, {
      stamina: 20,
      maxStamina: 20,
    });
    assert.equal(restored.stamina, 20);
  });

  it("keeps committed responses monotonic but rolls back rejected costs", () => {
    const projected = {
      observedStamina: 14,
      stamina: 8,
      maxStamina: 20,
    };
    assert.equal(
      reconcileHarthmereMovementFallbackResponse(projected, {
        stamina: 11,
        maxStamina: 20,
        accepted: true,
      }).stamina,
      8
    );
    assert.equal(
      reconcileHarthmereMovementFallbackResponse(projected, {
        stamina: 11,
        maxStamina: 20,
        accepted: false,
      }).stamina,
      11
    );
  });

  it("does not call REST when Sync confirms the action", async () => {
    let fetches = 0;
    const result = await confirmHarthmereMovementActionStamina({
      publish: Promise.resolve(),
      action: "dodge",
      direction: [1, 0, 0],
      nonce: 1,
      fetchImpl: (async () => {
        fetches += 1;
        return fallbackResponse(17);
      }) as typeof fetch,
      confirmAfterMs: 1,
    });
    assert.equal(result.source, "sync");
    assert.equal(fetches, 0);
  });

  it("charges through REST when Sync rejects or remains stalled", async () => {
    for (const publish of [
      Promise.reject(new Error("sync disconnected")),
      new Promise<void>(() => undefined),
    ]) {
      let bodySeen: unknown;
      const result = await confirmHarthmereMovementActionStamina({
        publish,
        action: "evade",
        direction: [1, 0, 0],
        nonce: 2,
        fetchImpl: (async (_input, init) => {
          bodySeen = JSON.parse(String(init?.body));
          return fallbackResponse(12);
        }) as typeof fetch,
        confirmAfterMs: 1,
        onVitals: () => undefined,
      });
      assert.equal(result.source, "fallback");
      assert.deepEqual(bodySeen, {
        action: "movement_action_fallback",
        movementAction: "evade",
        direction: [1, 0, 0],
        nonce: 2,
      });
    }
  });
});
