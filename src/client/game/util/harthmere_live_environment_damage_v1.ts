import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";

export function harthmereLiveModeEnvironmentDamageUrlV1(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereLiveModeEnvironmentDamageHeadersV1(search?: string) {
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

function dispatchHarthmereEnvironmentDamageStatusV1(body: any) {
  if (typeof window === "undefined" || !body?.playerStatusState) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
      detail: body.playerStatusState,
    })
  );
}

export async function submitHarthmereFallDamageLiveModeV1(
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
  const requestId = `${
    options.requestIdPrefix ?? "harthmere_fall_damage"
  }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchImpl(
    harthmereLiveModeEnvironmentDamageUrlV1(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveModeEnvironmentDamageHeadersV1(
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
  dispatchHarthmereEnvironmentDamageStatusV1(body);
  return body;
}

export async function submitHarthmereDrowningDamageLiveModeV1(
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
  const requestId = `${
    options.requestIdPrefix ?? "harthmere_drowning_damage"
  }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchImpl(
    harthmereLiveModeEnvironmentDamageUrlV1(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveModeEnvironmentDamageHeadersV1(
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
  dispatchHarthmereEnvironmentDamageStatusV1(body);
  return body;
}
