import {
  BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT,
  BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
} from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import { fallDamageForBlocks } from "@/shared/game/fall_damage";

export function harthmereLiveModeEnvironmentDamageUrl(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereLiveModeEnvironmentDamageHeaders(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (installId) {
    headers["X-Glitch-Install-Id"] = installId;
  }
  return headers;
}

function dispatchHarthmereEnvironmentDamageStatus(body: any) {
  if (typeof window === "undefined" || !body?.playerStatusState) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
      detail: body.playerStatusState,
    })
  );
}

function dispatchOptimisticHarthmereEnvironmentDamage(detail: {
  hpDelta?: number;
  hpPercentDelta?: number;
  label: string;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT, { detail })
  );
}

export async function submitHarthmereFallDamageLiveMode(
  fallBlocks: number,
  options: {
    fetchImpl?: typeof fetch;
    locationSearch?: string;
    requestIdPrefix?: string;
  } = {}
) {
  const blocks = Number(fallBlocks);
  if (!Number.isFinite(blocks) || blocks <= 0) {
    return undefined;
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const damagePercent = fallDamageForBlocks(blocks) / 100;
  if (damagePercent > 0) {
    dispatchOptimisticHarthmereEnvironmentDamage({
      hpPercentDelta: -damagePercent,
      label: "Fall damage",
    });
  }
  const requestId = `${
    options.requestIdPrefix ?? "harthmere_fall_damage"
  }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereLiveModeEnvironmentDamageUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveModeEnvironmentDamageHeaders(
        options.locationSearch
      ),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        actionKind: "request_environment_damage",
        subsystem: "combat",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: {
          damageKind: "fall",
          fallBlocks: blocks,
        },
        clientClaims: {},
      }),
    }
  );
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error("harthmere_fall_damage_live_mode_failed");
  }
  dispatchHarthmereEnvironmentDamageStatus(body);
  return body;
}

export async function submitHarthmereDrowningDamageLiveMode(
  damage: number,
  options: {
    fetchImpl?: typeof fetch;
    locationSearch?: string;
    requestIdPrefix?: string;
  } = {}
) {
  const amount = Number(damage);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  dispatchOptimisticHarthmereEnvironmentDamage({
    hpDelta: -amount,
    label: "Drowning damage",
  });
  const requestId = `${
    options.requestIdPrefix ?? "harthmere_drowning_damage"
  }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereLiveModeEnvironmentDamageUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveModeEnvironmentDamageHeaders(
        options.locationSearch
      ),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        actionKind: "request_environment_damage",
        subsystem: "combat",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: {
          damageKind: "drowning",
          damage: amount,
        },
        clientClaims: {},
      }),
    }
  );
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error("harthmere_drowning_damage_live_mode_failed");
  }
  dispatchHarthmereEnvironmentDamageStatus(body);
  return body;
}
