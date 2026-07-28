import {
  defaultHarthmereLiveFetch,
  runHarthmereLiveMutationOnce,
  runHarthmereLiveMutationSerially,
} from "@/client/components/harthmere_live_fetch";

// Building materialization can legitimately touch many terrain shards. Keep a
// single request alive beyond the generic mutation timeout so the browser does
// not create overlapping retries while the authoritative world write finishes.
export const HARTHMERE_BUILDING_MUTATION_TIMEOUT_MS = 90_000;

function stableBuildingMutationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableBuildingMutationValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableBuildingMutationValue(child)])
    );
  }
  return value;
}

export function harthmereBuildingMutationSemanticKey(
  action: string,
  payload: Record<string, unknown>
) {
  return `building-system:${action}:${JSON.stringify(
    stableBuildingMutationValue(payload)
  )}`;
}

async function readBuildingActionResponse(
  response: Response,
  errorPrefix: string
): Promise<any> {
  const body = await response.json().catch(() => ({}));
  const errors = Array.isArray(body?.errors)
    ? body.errors.map((error: unknown) => String(error))
    : [];
  if (!response.ok) {
    errors.push(`${errorPrefix}_http_${response.status}`);
    if (typeof body?.error === "string" && body.error.trim()) {
      errors.push(body.error.trim());
    }
  }
  return {
    ...body,
    ok: response.ok && body?.ok !== false,
    errors: [...new Set(errors)],
  };
}

export async function submitHarthmereBuildingLiveModeAction(
  action: string,
  payload: Record<string, unknown>
): Promise<any> {
  if (typeof fetch !== "function") {
    return { ok: false, errors: ["fetch_unavailable"] };
  }
  if (action === "read_state") {
    const response = await defaultHarthmereLiveFetch(
      "/api/harthmere/live_mode_building_state",
      {
        method: "GET",
        credentials: "same-origin",
      }
    );
    return readBuildingActionResponse(response, "building_state");
  }

  const semanticKey = harthmereBuildingMutationSemanticKey(action, payload);
  return runHarthmereLiveMutationOnce(semanticKey, () =>
    runHarthmereLiveMutationSerially("building-system", async () => {
      const requestId = `biomes_ui_building_${action}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/live_mode",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_property_building_mutation",
            subsystem: "building",
            actorEntityVersion: 1,
            zoneId: "the_grove",
            payload: {
              buildingAction: action,
              ...payload,
            },
            clientClaims: {},
          }),
          timeoutMs: HARTHMERE_BUILDING_MUTATION_TIMEOUT_MS,
        }
      );
      return readBuildingActionResponse(response, "building_action");
    })
  );
}
