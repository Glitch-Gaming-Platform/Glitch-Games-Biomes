import {
  HARTHMERE_DEFAULT_MAX_STAMINA_V1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  tickHarthmereStaminaV1,
  type HarthmereFoodStaminaStateV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import {
  downHarthmerePlayerFromSystem,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import React, { useEffect, useState } from "react";

export const HARTHMERE_FOOD_STAMINA_STATE_KEY =
  "biomes.localDev.harthmere.foodStaminaState.v1";
export const HARTHMERE_FOOD_STAMINA_EVENT =
  "biomes:harthmere-food-stamina-changed";

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function dispatchFoodStaminaEvent() {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(HARTHMERE_FOOD_STAMINA_EVENT));
  }
}

function normalizeFoodStaminaState(
  raw: Partial<HarthmereFoodStaminaStateV1> | undefined,
): HarthmereFoodStaminaStateV1 {
  const now = Date.now();
  const fallback = defaultHarthmereFoodStaminaStateV1("local-player", now);
  return {
    actorId: String(raw?.actorId ?? fallback.actorId),
    stamina: Math.max(0, Math.min(Number(raw?.maxStamina ?? fallback.maxStamina), Number(raw?.stamina ?? fallback.stamina))),
    maxStamina: Math.max(1, Number(raw?.maxStamina ?? HARTHMERE_DEFAULT_MAX_STAMINA_V1)),
    lastStaminaTickMs: Number.isFinite(raw?.lastStaminaTickMs) ? Number(raw?.lastStaminaTickMs) : now,
    deadFromStaminaAtMs: Number.isFinite(raw?.deadFromStaminaAtMs) ? Number(raw?.deadFromStaminaAtMs) : undefined,
    inventory: raw?.inventory ?? fallback.inventory,
    plots: raw?.plots ?? {},
    spawns: raw?.spawns ?? {},
  };
}

export function readHarthmereFoodStaminaState(): HarthmereFoodStaminaStateV1 {
  if (!isBrowser()) {
    return defaultHarthmereFoodStaminaStateV1("local-player", Date.now());
  }
  try {
    const raw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_FOOD_STAMINA_STATE_KEY),
    );
    return normalizeFoodStaminaState(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultHarthmereFoodStaminaStateV1("local-player", Date.now());
  }
}

export function writeHarthmereFoodStaminaState(state: HarthmereFoodStaminaStateV1) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_FOOD_STAMINA_STATE_KEY),
    JSON.stringify(normalizeFoodStaminaState(state)),
  );
  dispatchFoodStaminaEvent();
}

export function useHarthmereFoodStaminaState() {
  const [state, setState] = useState(() => readHarthmereFoodStaminaState());
  useEffect(() => {
    const refresh = () => setState(readHarthmereFoodStaminaState());
    window.addEventListener(HARTHMERE_FOOD_STAMINA_EVENT, refresh);
    return () => window.removeEventListener(HARTHMERE_FOOD_STAMINA_EVENT, refresh);
  }, []);
  return state;
}

export function eatHarthmereFoodForStamina(itemId: string) {
  const before = readHarthmereFoodStaminaState();
  const result = eatHarthmereFoodV1({
    ...before,
    inventory: { ...before.inventory, [itemId]: Math.max(1, before.inventory[itemId] ?? 0) },
  }, {
    itemId,
    nowMs: Date.now(),
  });
  writeHarthmereFoodStaminaState({
    ...result.state,
    inventory: before.inventory,
  });
  return result;
}

export const HarthmereFoodStaminaRuntimeController: React.FunctionComponent<{}> = () => {
  useEffect(() => {
    const tick = () => {
      const result = tickHarthmereStaminaV1(readHarthmereFoodStaminaState(), Date.now());
      writeHarthmereFoodStaminaState(result.state);
      if (result.deathTriggered) {
        downHarthmerePlayerFromSystem({
          cause: "Stamina reached zero",
          killerName: "Starvation and exhaustion",
          detail: "You ran out of stamina. Eat food to keep your body going.",
        });
      }
    };
    const id = window.setInterval(tick, 15_000);
    tick();
    return () => window.clearInterval(id);
  }, []);
  return null;
};
