import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import type {
  ReadonlyHealth,
  ReadonlyTriggerState,
} from "@/shared/ecs/gen/components";
import {
  readHarthmereNativeVitals,
  type HarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import React from "react";

export interface HarthmereNativeVitalsHeartbeatSnapshot {
  vitals: HarthmereNativeVitals;
  health: { hp: number; maxHp: number };
  receivedAtMs: number;
}

export interface HarthmereNativeVitalsProjection {
  vitals: HarthmereNativeVitals;
  health?: { hp: number; maxHp: number };
  hasAuthoritativeVitals: boolean;
  hasAuthoritativeHealth: boolean;
  source: "ecs" | "heartbeat" | "hybrid" | "native-default";
}

type NativeVitalsHeartbeatBody = {
  ok?: unknown;
  mana?: unknown;
  maxMana?: unknown;
  stamina?: unknown;
  maxStamina?: unknown;
  breath?: unknown;
  maxBreath?: unknown;
  hp?: unknown;
  maxHp?: unknown;
};

function finite(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeHarthmereNativeVitalsHeartbeatForTest(
  body: NativeVitalsHeartbeatBody,
  receivedAtMs = Date.now()
): HarthmereNativeVitalsHeartbeatSnapshot | undefined {
  if (body.ok !== true) return undefined;
  const mana = finite(body.mana);
  const maxMana = finite(body.maxMana);
  const stamina = finite(body.stamina);
  const maxStamina = finite(body.maxStamina);
  const breath = finite(body.breath);
  const maxBreath = finite(body.maxBreath);
  const hp = finite(body.hp);
  const maxHp = finite(body.maxHp);
  if (
    mana === undefined ||
    maxMana === undefined ||
    stamina === undefined ||
    maxStamina === undefined ||
    breath === undefined ||
    maxBreath === undefined ||
    hp === undefined ||
    maxHp === undefined
  ) {
    return undefined;
  }
  const defaults = readHarthmereNativeVitals(undefined);
  return {
    vitals: {
      ...defaults,
      mana: Math.max(0, Math.min(Math.max(1, maxMana), mana)),
      maxMana: Math.max(1, maxMana),
      stamina: Math.max(0, Math.min(Math.max(1, maxStamina), stamina)),
      maxStamina: Math.max(1, maxStamina),
      breath: Math.max(0, Math.min(Math.max(1, maxBreath), breath)),
      maxBreath: Math.max(1, maxBreath),
    },
    health: {
      hp: Math.max(0, Math.min(Math.max(1, maxHp), hp)),
      maxHp: Math.max(1, maxHp),
    },
    receivedAtMs,
  };
}

export function resolveHarthmereNativeVitalsProjectionForTest(input: {
  ecsVitals?: HarthmereNativeVitals;
  ecsHealth?: { hp: number; maxHp: number };
  heartbeat?: HarthmereNativeVitalsHeartbeatSnapshot;
}): HarthmereNativeVitalsProjection {
  const vitals =
    input.ecsVitals ??
    input.heartbeat?.vitals ??
    readHarthmereNativeVitals(undefined);
  const health = input.ecsHealth ?? input.heartbeat?.health;
  const hasAuthoritativeVitals = Boolean(
    input.ecsVitals || input.heartbeat?.vitals
  );
  const hasAuthoritativeHealth = Boolean(
    input.ecsHealth || input.heartbeat?.health
  );
  const source =
    input.ecsVitals && input.ecsHealth
      ? "ecs"
      : input.heartbeat && !input.ecsVitals && !input.ecsHealth
        ? "heartbeat"
        : input.heartbeat || input.ecsVitals || input.ecsHealth
          ? "hybrid"
          : "native-default";
  return {
    vitals,
    health,
    hasAuthoritativeVitals,
    hasAuthoritativeHealth,
    source,
  };
}

let latestHeartbeat: HarthmereNativeVitalsHeartbeatSnapshot | undefined;
let heartbeatInFlight: Promise<void> | undefined;
let heartbeatController: AbortController | undefined;
let heartbeatInterval: number | undefined;
const heartbeatListeners = new Set<
  (snapshot: HarthmereNativeVitalsHeartbeatSnapshot | undefined) => void
>();

async function refreshHarthmereNativeVitalsHeartbeat() {
  if (
    heartbeatInFlight ||
    typeof window === "undefined" ||
    !nativeBiomesEcsAuthorityEnabled()
  ) {
    return heartbeatInFlight;
  }
  heartbeatInFlight = (async () => {
    heartbeatController = new AbortController();
    try {
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/native_vitals",
        {
          method: "POST",
          credentials: "same-origin",
          signal: heartbeatController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat" }),
        }
      );
      const body = (await response.json().catch(() => undefined)) as
        | NativeVitalsHeartbeatBody
        | undefined;
      const next = body
        ? normalizeHarthmereNativeVitalsHeartbeatForTest(body)
        : undefined;
      if (!next) return;
      latestHeartbeat = next;
      for (const listener of heartbeatListeners) listener(next);
    } catch {
      // Keep the last authoritative read. The next bounded heartbeat retries
      // without waking the legacy local stamina/death authority.
    } finally {
      heartbeatController = undefined;
      heartbeatInFlight = undefined;
    }
  })();
  return heartbeatInFlight;
}

function subscribeToHarthmereNativeVitalsHeartbeat(
  listener: (
    snapshot: HarthmereNativeVitalsHeartbeatSnapshot | undefined
  ) => void
) {
  heartbeatListeners.add(listener);
  listener(latestHeartbeat);
  if (heartbeatListeners.size === 1 && typeof window !== "undefined") {
    void refreshHarthmereNativeVitalsHeartbeat();
    heartbeatInterval = window.setInterval(
      () => void refreshHarthmereNativeVitalsHeartbeat(),
      15_000
    );
  }
  return () => {
    heartbeatListeners.delete(listener);
    if (heartbeatListeners.size === 0 && typeof window !== "undefined") {
      if (heartbeatInterval !== undefined) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = undefined;
      }
      heartbeatController?.abort();
      latestHeartbeat = undefined;
    }
  };
}

export function useHarthmereNativeVitalsProjection(
  triggerState: ReadonlyTriggerState | undefined,
  health: ReadonlyHealth | undefined
): HarthmereNativeVitalsProjection {
  const [heartbeat, setHeartbeat] = React.useState(latestHeartbeat);
  React.useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    return subscribeToHarthmereNativeVitalsHeartbeat(setHeartbeat);
  }, []);

  const ecsVitals = triggerState
    ? readHarthmereNativeVitals(triggerState)
    : undefined;
  const ecsHealth = health
    ? { hp: Number(health.hp), maxHp: Number(health.maxHp) }
    : undefined;
  return resolveHarthmereNativeVitalsProjectionForTest({
    ecsVitals,
    ecsHealth,
    heartbeat,
  });
}
