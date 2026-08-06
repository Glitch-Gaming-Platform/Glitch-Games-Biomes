import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type { MovementActionType } from "@/shared/ecs/gen/types";
import { movementActionStaminaCost } from "@/shared/game/movement_actions";
import {
  readHarthmereNativeVitals,
  spendHarthmereNativeStamina,
} from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";

// Movement actions normally arrive through Sync. A bounded receipt ring lets
// the authenticated REST fallback charge the same nonce when Sync stalls,
// without double-spending if the original event commits before or afterward.
export const HARTHMERE_MOVEMENT_ACTION_RECEIPT_ROOT =
  8_740_000_000_000_201 as BiomesId;
const RECEIPT_INDEX_KEY = 8_740_000_000_000_202 as BiomesId;
const RECEIPT_SLOT_BASE = 8_740_000_000_000_220;
export const HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY = 32;

function finiteNonce(nonce: number) {
  return Number.isFinite(nonce) ? nonce : undefined;
}

function receiptValues(state: ReadonlyTriggerState | TriggerState | undefined) {
  return state?.by_root.get(HARTHMERE_MOVEMENT_ACTION_RECEIPT_ROOT);
}

export function hasHarthmereMovementActionReceipt(
  state: ReadonlyTriggerState | TriggerState | undefined,
  nonce: number
) {
  const target = finiteNonce(nonce);
  if (target === undefined) return false;
  const values = receiptValues(state);
  if (!values) return false;
  for (
    let index = 0;
    index < HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY;
    index += 1
  ) {
    if (values.get((RECEIPT_SLOT_BASE + index) as BiomesId) === target) {
      return true;
    }
  }
  return false;
}

export function recordHarthmereMovementActionReceipt(
  state: TriggerState,
  nonce: number
) {
  const target = finiteNonce(nonce);
  if (target === undefined) return false;
  if (hasHarthmereMovementActionReceipt(state, target)) return false;
  let values = receiptValues(state);
  if (!values) {
    values = new Map();
    state.by_root.set(HARTHMERE_MOVEMENT_ACTION_RECEIPT_ROOT, values);
  }
  const index =
    Math.max(0, Math.trunc(Number(values.get(RECEIPT_INDEX_KEY) ?? 0))) %
    HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY;
  values.set((RECEIPT_SLOT_BASE + index) as BiomesId, target);
  values.set(
    RECEIPT_INDEX_KEY,
    (index + 1) % HARTHMERE_MOVEMENT_ACTION_RECEIPT_CAPACITY
  );
  return true;
}

export type HarthmereMovementActionStaminaReceiptResult =
  | {
      accepted: true;
      duplicate: boolean;
      stamina: number;
      maxStamina: number;
    }
  | {
      accepted: false;
      duplicate: false;
      reason: "dead" | "insufficient_stamina" | "invalid_nonce";
      stamina: number;
      maxStamina: number;
    };

export function applyHarthmereMovementActionStaminaReceipt(
  state: TriggerState,
  input: {
    action: MovementActionType;
    nonce: number;
    alive: boolean;
  }
): HarthmereMovementActionStaminaReceiptResult {
  const before = readHarthmereNativeVitals(state);
  if (finiteNonce(input.nonce) === undefined) {
    return {
      accepted: false,
      duplicate: false,
      reason: "invalid_nonce",
      stamina: before.stamina,
      maxStamina: before.maxStamina,
    };
  }
  if (hasHarthmereMovementActionReceipt(state, input.nonce)) {
    return {
      accepted: true,
      duplicate: true,
      stamina: before.stamina,
      maxStamina: before.maxStamina,
    };
  }
  if (!input.alive) {
    return {
      accepted: false,
      duplicate: false,
      reason: "dead",
      stamina: before.stamina,
      maxStamina: before.maxStamina,
    };
  }
  const spent = spendHarthmereNativeStamina(
    state,
    movementActionStaminaCost(input.action)
  );
  if (!spent.spent) {
    return {
      accepted: false,
      duplicate: false,
      reason: "insufficient_stamina",
      stamina: before.stamina,
      maxStamina: before.maxStamina,
    };
  }
  recordHarthmereMovementActionReceipt(state, input.nonce);
  return {
    accepted: true,
    duplicate: false,
    stamina: spent.vitals.stamina,
    maxStamina: spent.vitals.maxStamina,
  };
}
