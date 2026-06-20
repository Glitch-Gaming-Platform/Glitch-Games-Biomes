import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";

export const HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT =
  "biomes:harthmere-dialogue-live-mode-response" as const;

export function harthmereDialogueLiveModeUrl(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereDialogueLiveModeHeaders(search?: string) {
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

function dispatchHarthmereDialogueLiveModeResponse(body: any) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT, {
      detail: body,
    })
  );
}

function dispatchHarthmereDialoguePlayerStatus(body: any) {
  if (typeof window === "undefined") return;
  if (body?.playerStatusState) {
    window.dispatchEvent(
      new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
        detail: body.playerStatusState,
      })
    );
  }
}

function harthmereDialogueWorldDeltas(likeabilityDelta: number) {
  const sign = Math.sign(likeabilityDelta);
  if (sign === 0) {
    return { likeabilityDelta: 0, legalDelta: 0, notorietyDelta: 0 };
  }
  const magnitude = Math.max(1, Math.ceil(Math.abs(likeabilityDelta) / 3));
  return {
    likeabilityDelta: sign * magnitude,
    legalDelta: sign < 0 ? -magnitude : 0,
    notorietyDelta: sign < 0 ? magnitude : 0,
  };
}

export function harthmereDialogueLiveModeMutationsForChoice(input: {
  entityId: string | number;
  label?: string;
  message: string;
  likeabilityDelta: number;
}) {
  const personalScopeId = `npc:${String(input.entityId)}`;
  const worldDeltas = harthmereDialogueWorldDeltas(input.likeabilityDelta);
  const reason =
    input.likeabilityDelta < 0
      ? "dialogue_choice_rude"
      : input.likeabilityDelta > 0
      ? "dialogue_choice_friendly"
      : "dialogue_choice_neutral";
  return [
    {
      factionId: personalScopeId,
      likeabilityDelta: input.likeabilityDelta,
      legalDelta: 0,
      notorietyDelta: 0,
      witnessLevel: "direct",
      reason,
      dialogueChoice: input.message,
      entityId: String(input.entityId),
      entityLabel: input.label,
      scope: "personal_npc",
    },
    {
      factionId: "harthmere",
      ...worldDeltas,
      witnessLevel: "public",
      reason,
      dialogueChoice: input.message,
      entityId: String(input.entityId),
      entityLabel: input.label,
      scope: "world",
    },
  ].filter(
    (payload) =>
      payload.likeabilityDelta !== 0 ||
      payload.legalDelta !== 0 ||
      payload.notorietyDelta !== 0
  );
}

export async function submitHarthmereDialogueLiveModeChoice(
  input: {
    entityId: string | number;
    label?: string;
    message: string;
    likeabilityDelta: number;
  },
  options: {
    fetchImpl?: typeof fetch;
    requestIdPrefix?: string;
    locationSearch?: string;
  } = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mutations = harthmereDialogueLiveModeMutationsForChoice(input);
  let latestBody: any;
  for (const [index, payload] of mutations.entries()) {
    const requestId = `${
      options.requestIdPrefix ?? "dialogue_choice"
    }_${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`;
    const response = await fetchImpl(
      harthmereDialogueLiveModeUrl(options.locationSearch),
      {
        method: "POST",
        credentials: "same-origin",
        headers: harthmereDialogueLiveModeHeaders(options.locationSearch),
        body: JSON.stringify({
          requestId,
          idempotencyKey: requestId,
          targetId: String(input.entityId),
          actionKind: "request_law_reputation_mutation",
          subsystem: "law",
          actorEntityVersion: 1,
          targetEntityVersion: 1,
          zoneId: "harthmere",
          clientSentAtMs: Date.now(),
          payload,
          clientClaims: {},
        }),
      }
    );
    latestBody = await response.json();
    dispatchHarthmereDialogueLiveModeResponse(latestBody);
    if (!response.ok || latestBody?.ok === false) {
      throw new Error(
        latestBody?.error ??
          latestBody?.validation?.errors?.join(",") ??
          latestBody?.validation?.warnings?.join(",") ??
          latestBody?.backendMutation?.warnings?.join(",") ??
          "dialogue_reputation_mutation_failed"
      );
    }
  }
  dispatchHarthmereDialoguePlayerStatus(latestBody);
  return latestBody;
}
