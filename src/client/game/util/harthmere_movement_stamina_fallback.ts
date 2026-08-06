import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import type { MovementActionType, ReadonlyVec3f } from "@/shared/ecs/gen/types";
import {
  HARTHMERE_NATIVE_VITALS_CLIENT_UPDATE_EVENT,
  type HarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";

export const HARTHMERE_MOVEMENT_ACTION_SYNC_CONFIRM_MS = 1_000;

export interface HarthmereMovementStaminaProjection {
  observedStamina: number;
  stamina: number;
  maxStamina: number;
}

export interface HarthmereMovementActionFallbackBody {
  ok: boolean;
  action: "movement_action_fallback";
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  breath: number;
  maxBreath: number;
  hp: number;
  maxHp: number;
  damage: number;
  accepted?: boolean;
  duplicate?: boolean;
  reason?: "dead" | "insufficient_stamina" | "invalid_nonce";
}

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function reconcileHarthmereMovementStaminaProjection(
  current: HarthmereMovementStaminaProjection | undefined,
  observed: Pick<HarthmereNativeVitals, "stamina" | "maxStamina">
): HarthmereMovementStaminaProjection {
  const maxStamina = Math.max(1, finite(observed.maxStamina, 1));
  const observedStamina = Math.max(
    0,
    Math.min(maxStamina, finite(observed.stamina, maxStamina))
  );
  if (!current) {
    return { observedStamina, stamina: observedStamina, maxStamina };
  }
  const restored = observedStamina > current.observedStamina + 1e-6;
  return {
    observedStamina,
    stamina: restored
      ? observedStamina
      : Math.min(current.stamina, observedStamina),
    maxStamina,
  };
}

export function reserveHarthmereMovementStamina(
  current: HarthmereMovementStaminaProjection,
  cost: number
): HarthmereMovementStaminaProjection {
  return {
    ...current,
    stamina: Math.max(0, current.stamina - Math.max(0, finite(cost, 0))),
  };
}

export function reconcileHarthmereMovementFallbackResponse(
  current: HarthmereMovementStaminaProjection,
  body: Pick<
    HarthmereMovementActionFallbackBody,
    "stamina" | "maxStamina" | "accepted"
  >
): HarthmereMovementStaminaProjection {
  const maxStamina = Math.max(1, finite(body.maxStamina, current.maxStamina));
  const stamina = Math.max(
    0,
    Math.min(maxStamina, finite(body.stamina, current.stamina))
  );
  return {
    observedStamina: current.observedStamina,
    stamina:
      body.accepted === false ? stamina : Math.min(current.stamina, stamina),
    maxStamina,
  };
}

export function dispatchHarthmereNativeVitalsClientUpdate(body: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_NATIVE_VITALS_CLIENT_UPDATE_EVENT, {
      detail: body,
    })
  );
}

export async function confirmHarthmereMovementActionStamina(input: {
  publish: Promise<unknown>;
  action: MovementActionType;
  direction: ReadonlyVec3f;
  nonce: number;
  fetchImpl?: typeof fetch;
  confirmAfterMs?: number;
  onVitals?: (body: HarthmereMovementActionFallbackBody) => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const syncOutcome = input.publish.then(
    () => "confirmed" as const,
    () => "failed" as const
  );
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(
      () => resolve("timeout"),
      input.confirmAfterMs ?? HARTHMERE_MOVEMENT_ACTION_SYNC_CONFIRM_MS
    );
  });
  const outcome = await Promise.race([syncOutcome, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  if (outcome === "confirmed") {
    return { source: "sync" as const };
  }

  const response = await fetchHarthmereLiveWithTimeout(
    input.fetchImpl ?? fetch,
    "/api/harthmere/native_vitals",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 5_000,
      body: JSON.stringify({
        action: "movement_action_fallback",
        movementAction: input.action,
        direction: input.direction,
        nonce: input.nonce,
      }),
    }
  );
  const body = (await response.json()) as HarthmereMovementActionFallbackBody;
  if (!response.ok || body.ok !== true) {
    throw new Error("harthmere_movement_action_stamina_fallback_failed");
  }
  (input.onVitals ?? dispatchHarthmereNativeVitalsClientUpdate)(body);
  return { source: "fallback" as const, body };
}
