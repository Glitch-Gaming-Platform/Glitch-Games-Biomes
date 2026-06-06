import {
  HARTHMERE_DEFAULT_MAX_STAMINA_V1,
  HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  restoreHarthmereStaminaToFullV1,
  tickHarthmereStaminaForGameplayV1,
  type HarthmereFoodStaminaStateV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { downHarthmerePlayerFromSystem } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import React, { useEffect, useState } from "react";

export const HARTHMERE_FOOD_STAMINA_STATE_KEY =
  "biomes.localDev.harthmere.foodStaminaState.v1";
export const HARTHMERE_FOOD_STAMINA_EVENT =
  "biomes:harthmere-food-stamina-changed";
export const HARTHMERE_WAKE_UP_ACTIVE_DATASET_KEY_V1 =
  "harthmereWakeUpActive" as const;

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
  raw: Partial<HarthmereFoodStaminaStateV1> | undefined
): HarthmereFoodStaminaStateV1 {
  const now = Date.now();
  const fallback = defaultHarthmereFoodStaminaStateV1("local-player", now);
  const maxStamina = Math.max(
    1,
    Number(raw?.maxStamina ?? HARTHMERE_DEFAULT_MAX_STAMINA_V1)
  );
  const savedStateVersion = raw?.stateVersion;
  const migratingFromOldFastDrain =
    raw !== undefined &&
    savedStateVersion !== HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1;
  const savedStamina = Math.max(
    0,
    Math.min(maxStamina, Number(raw?.stamina ?? fallback.stamina))
  );
  const savedDeathAt = Number.isFinite(raw?.deadFromStaminaAtMs)
    ? Number(raw?.deadFromStaminaAtMs)
    : undefined;
  const repairPlayableZeroStamina =
    savedStamina <= 0 && savedDeathAt === undefined;
  const resetToPlayableStamina =
    (migratingFromOldFastDrain && savedStamina <= 0) ||
    repairPlayableZeroStamina;

  return {
    stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1,
    actorId: String(raw?.actorId ?? fallback.actorId),
    // Older local-dev saves used a much faster starvation pace. If one of
    // those saves had already hit zero, migrate it back to a playable bar
    // instead of killing the player immediately after deploy.
    stamina: resetToPlayableStamina ? maxStamina : savedStamina,
    maxStamina,
    lastStaminaTickMs: resetToPlayableStamina
      ? now
      : Number.isFinite(raw?.lastStaminaTickMs)
      ? Number(raw?.lastStaminaTickMs)
      : now,
    deadFromStaminaAtMs:
      migratingFromOldFastDrain || repairPlayableZeroStamina
        ? undefined
        : savedDeathAt,
    inventory: raw?.inventory ?? fallback.inventory,
    plots: raw?.plots ?? {},
    spawns: raw?.spawns ?? {},
    livestock: raw?.livestock ?? {},
    cooking: raw?.cooking ?? {},
  };
}

export const normalizeFoodStaminaStateForTest = normalizeFoodStaminaState;

export function readHarthmereFoodStaminaState(): HarthmereFoodStaminaStateV1 {
  if (!isBrowser()) {
    return defaultHarthmereFoodStaminaStateV1("local-player", Date.now());
  }
  try {
    const raw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_FOOD_STAMINA_STATE_KEY)
    );
    return normalizeFoodStaminaState(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultHarthmereFoodStaminaStateV1("local-player", Date.now());
  }
}

export function writeHarthmereFoodStaminaState(
  state: HarthmereFoodStaminaStateV1
) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_FOOD_STAMINA_STATE_KEY),
    JSON.stringify(normalizeFoodStaminaState(state))
  );
  dispatchFoodStaminaEvent();
}

export function isHarthmereWakeUpScreenActiveV1() {
  return (
    isBrowser() &&
    document.documentElement.dataset[
      HARTHMERE_WAKE_UP_ACTIVE_DATASET_KEY_V1
    ] === "true"
  );
}

export function restoreHarthmereFoodStaminaToFullForRespawn(
  reason = "Restored stamina after respawn."
) {
  const before = readHarthmereFoodStaminaState();
  const result = restoreHarthmereStaminaToFullV1(before, Date.now());
  writeHarthmereFoodStaminaState(result.state);
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-food-stamina-restored", {
        detail: { reason, stamina: result.state.stamina },
      })
    );
  }
  return result;
}

export function useHarthmereFoodStaminaState() {
  const [state, setState] = useState(() => readHarthmereFoodStaminaState());
  useEffect(() => {
    const refresh = () => setState(readHarthmereFoodStaminaState());
    window.addEventListener(HARTHMERE_FOOD_STAMINA_EVENT, refresh);
    return () =>
      window.removeEventListener(HARTHMERE_FOOD_STAMINA_EVENT, refresh);
  }, []);
  return state;
}

export function eatHarthmereFoodForStamina(itemId: string) {
  const before = readHarthmereFoodStaminaState();
  const result = eatHarthmereFoodV1(
    {
      ...before,
      inventory: {
        ...before.inventory,
        [itemId]: Math.max(1, before.inventory[itemId] ?? 0),
      },
    },
    {
      itemId,
      nowMs: Date.now(),
    }
  );
  writeHarthmereFoodStaminaState({
    ...result.state,
    inventory: before.inventory,
  });
  return result;
}

export const HarthmereFoodStaminaRuntimeController: React.FunctionComponent<{}> =
  () => {
    useEffect(() => {
      const isGameplayActive = () => {
        if (!isBrowser() || document.visibilityState !== "visible") {
          return false;
        }
        if (isHarthmereWakeUpScreenActiveV1()) {
          return false;
        }
        return true;
      };
      const tick = () => {
        const result = tickHarthmereStaminaForGameplayV1(
          readHarthmereFoodStaminaState(),
          { nowMs: Date.now(), gameplayActive: isGameplayActive() }
        );
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
