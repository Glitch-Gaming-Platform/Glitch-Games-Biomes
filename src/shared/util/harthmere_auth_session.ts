export type HarthmereBiomesAuthSession = {
  userId: string | number;
  sessionId: string;
  installId?: string;
  titleId?: string;
  createdAtMs?: number;
};

const STORAGE_KEY = "harthmere.biomesAuth.v1";
const GLOBAL_KEY = "__HARTHMERE_BIOMES_AUTH_SESSION_V1";

function browserWindow() {
  return typeof window === "undefined" ? undefined : (window as any);
}

function normalizeSession(
  session: HarthmereBiomesAuthSession | undefined
): HarthmereBiomesAuthSession | undefined {
  if (!session?.userId || !session.sessionId) {
    return undefined;
  }
  return {
    ...session,
    userId: String(session.userId),
    sessionId: String(session.sessionId),
    createdAtMs: session.createdAtMs ?? Date.now(),
  };
}

function readStorage(storage: Storage | undefined) {
  if (!storage) {
    return undefined;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? normalizeSession(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(
  storage: Storage | undefined,
  session: HarthmereBiomesAuthSession
) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Third-party iframe storage can be unavailable in private windows.
  }
}

export function rememberHarthmereBiomesAuthSession(
  session: HarthmereBiomesAuthSession | undefined
) {
  const normalized = normalizeSession(session);
  const win = browserWindow();
  if (!win || !normalized) {
    return;
  }

  win[GLOBAL_KEY] = normalized;
  writeStorage(win.sessionStorage, normalized);
  writeStorage(win.localStorage, normalized);
}

export function readHarthmereBiomesAuthSession():
  | HarthmereBiomesAuthSession
  | undefined {
  const win = browserWindow();
  if (!win) {
    return undefined;
  }

  return (
    normalizeSession(win[GLOBAL_KEY]) ??
    readStorage(win.sessionStorage) ??
    readStorage(win.localStorage)
  );
}

export function harthmereBiomesAuthHeaders(
  input?: string | URL | RequestInfo
): Record<string, string> {
  const win = browserWindow();
  if (!win) {
    return {};
  }

  if (input) {
    try {
      const url =
        typeof input === "string" || input instanceof URL
          ? new URL(String(input), win.location.origin)
          : new URL(input.url, win.location.origin);
      if (url.origin !== win.location.origin) {
        return {};
      }
    } catch {
      return {};
    }
  }

  const session = readHarthmereBiomesAuthSession();
  if (!session) {
    return {};
  }

  return {
    "X-Biomes-User-Id": String(session.userId),
    "X-Biomes-Session-Id": session.sessionId,
  };
}
