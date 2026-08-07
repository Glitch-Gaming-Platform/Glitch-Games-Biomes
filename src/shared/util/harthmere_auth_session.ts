export type HarthmereBiomesAuthSession = {
  userId: string | number;
  sessionId: string;
  installId?: string;
  titleId?: string;
  createdAtMs?: number;
};

const STORAGE_KEY = "harthmere.biomesAuth";
const GLOBAL_KEY = "__HARTHMERE_BIOMES_AUTH_SESSION";
const INSTALL_ID_QUERY_KEYS = ["install_id", "installId"] as const;
const INSTALL_ID_STORAGE_KEYS = [
  "glitch.install.id",
  "biomes.localDev.harthmere.localInstallId",
] as const;

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function usableInstallId(value: unknown) {
  const installId = nonEmptyString(value);
  return installId && !installId.startsWith("local-") ? installId : undefined;
}

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
  HarthmereBiomesAuthSession | undefined {
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

export function harthmereInstallIdFromSearch(search: string) {
  const params = new URLSearchParams(search);
  for (const key of INSTALL_ID_QUERY_KEYS) {
    const installId = usableInstallId(params.get(key));
    if (installId) {
      return installId;
    }
  }
  return undefined;
}

export function readHarthmereInstallId(): string | undefined {
  const win = browserWindow();
  if (!win) {
    return undefined;
  }

  const queryInstallId = harthmereInstallIdFromSearch(win.location.search);
  if (queryInstallId) {
    return queryInstallId;
  }

  const sessionInstallId = usableInstallId(
    readHarthmereBiomesAuthSession()?.installId
  );
  if (sessionInstallId) {
    return sessionInstallId;
  }

  for (const key of INSTALL_ID_STORAGE_KEYS) {
    try {
      const installId = usableInstallId(win.localStorage?.getItem(key));
      if (installId) {
        return installId;
      }
    } catch {
      // Third-party iframe storage can be unavailable in private windows.
    }
  }
  return undefined;
}

export function hasHarthmereInstallIdentity() {
  return Boolean(readHarthmereInstallId());
}

export function buildHarthmereInstallRecoveryUrl(
  href: string,
  installId: string
) {
  const url = new URL(href);
  if (url.pathname === "/" || url.pathname.startsWith("/at")) {
    // Temporary install users can have labels such as "Guest User". That
    // label is not a durable public slug, so recovery must return to the
    // canonical install entrypoint rather than reloading /at/<label>.
    url.pathname = "/at";
  }
  for (const key of INSTALL_ID_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  url.searchParams.delete("anon");
  url.searchParams.set("install_id", installId);
  url.searchParams.set("glitch_auto_play", "1");
  return url.toString();
}

export function reloadPreservingHarthmereInstallIdentity() {
  const win = browserWindow();
  if (!win) {
    return;
  }
  const installId = readHarthmereInstallId();
  if (!installId) {
    win.location.reload();
    return;
  }
  win.location.replace(
    buildHarthmereInstallRecoveryUrl(win.location.href, installId)
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
