export const HARTHMERE_LIVE_READ_TIMEOUT_MS_V1 = 8_000;
export const HARTHMERE_LIVE_MUTATION_TIMEOUT_MS_V1 = 15_000;

export async function fetchHarthmereLiveWithTimeoutV1(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs: requestedTimeoutMs, ...requestInit } = init;
  if (requestInit.signal || typeof AbortController === "undefined") {
    return fetchImpl(input, requestInit);
  }
  const timeoutMs =
    requestedTimeoutMs ??
    (String(requestInit.method ?? "GET").toUpperCase() === "POST"
      ? HARTHMERE_LIVE_MUTATION_TIMEOUT_MS_V1
      : HARTHMERE_LIVE_READ_TIMEOUT_MS_V1);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function defaultHarthmereLiveFetchV1(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  return fetchHarthmereLiveWithTimeoutV1(fetch, input, init);
}
