import {
  HARTHMERE_DEFAULT_MAX_STAMINA,
  HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
  defaultHarthmereFoodStaminaState,
  eatHarthmereFood,
  restoreHarthmereStaminaToFull,
  tickHarthmereStaminaForGameplay,
  type HarthmereFoodStaminaState,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { downHarthmerePlayerFromSystem } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import React, { useEffect, useState } from "react";

export const HARTHMERE_FOOD_STAMINA_STATE_KEY =
  "biomes.localDev.harthmere.foodStaminaState";
export const HARTHMERE_FOOD_STAMINA_EVENT =
  "biomes:harthmere-food-stamina-changed";
export const HARTHMERE_WAKE_UP_ACTIVE_DATASET_KEY =
  "harthmereWakeUpActive" as const;
const HARTHMERE_LOCAL_INVENTORY_STATE_KEY_FOR_STAMINA =
  "biomes.localDev.harthmere.inventoryState";
const HARTHMERE_LOCAL_INVENTORY_EVENT_FOR_STAMINA =
  "biomes:harthmere-inventory-changed";

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

function addPositiveItemCount(
  items: Record<string, number>,
  itemId: unknown,
  count: unknown
) {
  const key = String(itemId ?? "").trim();
  const amount = Math.max(0, Math.trunc(Number(count) || 0));
  if (!key || amount <= 0) {
    return;
  }
  items[key] = (items[key] ?? 0) + amount;
}

export function carriedHarthmereLocalInventoryForStamina(
  raw: unknown
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const state = raw as {
    backpack?: { items?: unknown[] };
    materialStorage?: Record<string, unknown>;
  };
  const items: Record<string, number> = {};
  for (const entry of Array.isArray(state.backpack?.items)
    ? state.backpack.items
    : []) {
    const item = entry as { itemId?: unknown; quantity?: unknown };
    addPositiveItemCount(items, item.itemId, item.quantity ?? 1);
  }
  for (const [itemId, count] of Object.entries(state.materialStorage ?? {})) {
    addPositiveItemCount(items, itemId, count);
  }
  return items;
}

export function carriedHarthmereLocalInventoryFromStorageValuesForStamina(
  scopedRaw: string | null | undefined,
  legacyRaw: string | null | undefined
): Record<string, number> | undefined {
  for (const raw of [scopedRaw, legacyRaw]) {
    if (!raw) continue;
    try {
      const carried = carriedHarthmereLocalInventoryForStamina(
        JSON.parse(raw)
      );
      if (carried) return carried;
    } catch {
      // Try the next storage slot. User-scoped saves replaced the legacy key,
      // but old local-dev sessions may still only have the legacy entry.
    }
  }
  return undefined;
}

function readCurrentCarriedInventoryForStamina():
  | Record<string, number>
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  try {
    const scopedRaw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(
        HARTHMERE_LOCAL_INVENTORY_STATE_KEY_FOR_STAMINA
      )
    );
    const legacyRaw = window.localStorage.getItem(
      HARTHMERE_LOCAL_INVENTORY_STATE_KEY_FOR_STAMINA
    );
    return carriedHarthmereLocalInventoryFromStorageValuesForStamina(
      scopedRaw,
      legacyRaw
    );
  } catch {
    return undefined;
  }
}

function normalizeFoodStaminaState(
  raw: Partial<HarthmereFoodStaminaState> | undefined
): HarthmereFoodStaminaState {
  const now = Date.now();
  const fallback = defaultHarthmereFoodStaminaState("local-player", now);
  const maxStamina = Math.max(
    1,
    Number(raw?.maxStamina ?? HARTHMERE_DEFAULT_MAX_STAMINA)
  );
  const savedStateVersion = raw?.stateVersion;
  const migratingFromOldFastDrain =
    raw !== undefined &&
    savedStateVersion !== HARTHMERE_FARMING_FOOD_STAMINA_VERSION;
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
    stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
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

export function readHarthmereFoodStaminaState(): HarthmereFoodStaminaState {
  if (!isBrowser()) {
    return defaultHarthmereFoodStaminaState("local-player", Date.now());
  }
  try {
    const raw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_FOOD_STAMINA_STATE_KEY)
    );
    return normalizeFoodStaminaState(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultHarthmereFoodStaminaState("local-player", Date.now());
  }
}

export function writeHarthmereFoodStaminaState(
  state: HarthmereFoodStaminaState
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

export function isHarthmereWakeUpScreenActive() {
  return (
    isBrowser() &&
    document.documentElement.dataset[
      HARTHMERE_WAKE_UP_ACTIVE_DATASET_KEY
    ] === "true"
  );
}

export function restoreHarthmereFoodStaminaToFullForRespawn(
  reason = "Restored stamina after respawn."
) {
  const before = readHarthmereFoodStaminaState();
  const result = restoreHarthmereStaminaToFull(before, Date.now());
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
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HARTHMERE_FOOD_STAMINA_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}

export function eatHarthmereFoodForStamina(itemId: string) {
  const before = readHarthmereFoodStaminaState();
  const result = eatHarthmereFood(
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
        if (isHarthmereWakeUpScreenActive()) {
          return false;
        }
        return true;
      };
      const tick = () => {
        const before = readHarthmereFoodStaminaState();
        const carriedInventory = readCurrentCarriedInventoryForStamina();
        const result = tickHarthmereStaminaForGameplay(
          carriedInventory
            ? { ...before, inventory: carriedInventory }
            : before,
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
      window.addEventListener(
        HARTHMERE_LOCAL_INVENTORY_EVENT_FOR_STAMINA,
        tick
      );
      window.addEventListener("storage", tick);
      tick();
      return () => {
        window.clearInterval(id);
        window.removeEventListener(
          HARTHMERE_LOCAL_INVENTORY_EVENT_FOR_STAMINA,
          tick
        );
        window.removeEventListener("storage", tick);
      };
    }, []);
    return null;
  };
