export interface GlitchMutableHotfixBrowserState {
  version: string;
  hash: string;
  cleanup?: () => void;
  registerCleanup: (cleanup: () => void) => void;
}

interface GlitchMutableHotfixDescriptor {
  active: boolean;
  version?: string;
  hash?: string;
  reload?: "never" | "on-change";
  scriptUrl?: string;
  pollMs?: number;
}

declare global {
  interface Window {
    __biomesGlitchMutableHotfix?: GlitchMutableHotfixBrowserState;
    __biomesGlitchMutableHotfixPollerInstalled?: boolean;
  }
}

const ENDPOINT = "/api/mutable_hotfix";
const DEFAULT_POLL_MS = 5_000;
const MIN_POLL_MS = 1_000;
const MAX_POLL_MS = 60_000;
const RELOAD_KEY = "biomes:mutable-hotfix:last-reload";
const STYLE_ID = "biomes-glitch-mutable-hotfix-style";

function boundedPollMs(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_POLL_MS;
  }
  return Math.max(MIN_POLL_MS, Math.min(MAX_POLL_MS, parsed));
}

function removeCurrentHotfix() {
  const current = window.__biomesGlitchMutableHotfix;
  try {
    current?.cleanup?.();
  } catch (error) {
    console.error("Mutable hotfix cleanup failed", error);
  }
  document.getElementById(STYLE_ID)?.remove();
  delete window.__biomesGlitchMutableHotfix;
  window.dispatchEvent(
    new CustomEvent("biomes:mutable-hotfix-cleared", {
      detail: current
        ? { version: current.version, hash: current.hash }
        : undefined,
    })
  );
}

function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.biomesMutableHotfix = "1";
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("mutable_hotfix_client_script_failed"));
    };
    document.head.appendChild(script);
  });
}

function reloadForHash(hash: string) {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === hash) {
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, hash);
  } catch {
    // Storage hardening normally makes this safe, but loading the patch is still
    // preferable to entering a reload loop if a browser blocks sessionStorage.
    return false;
  }
  window.location.reload();
  return true;
}

export async function pollGlitchMutableHotfixOnce(
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  const response = await fetchImpl(ENDPOINT, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`mutable_hotfix_descriptor_failed:${response.status}`);
  }
  const descriptor = (await response.json()) as GlitchMutableHotfixDescriptor;
  const pollMs = boundedPollMs(descriptor.pollMs);
  const current = window.__biomesGlitchMutableHotfix;

  if (!descriptor.active) {
    if (current) {
      removeCurrentHotfix();
    }
    return pollMs;
  }
  if (!descriptor.hash || !descriptor.scriptUrl || !descriptor.version) {
    throw new Error("mutable_hotfix_descriptor_invalid");
  }
  if (current?.hash === descriptor.hash) {
    return pollMs;
  }
  if (
    current &&
    descriptor.reload === "on-change" &&
    reloadForHash(descriptor.hash)
  ) {
    return pollMs;
  }
  await loadScript(descriptor.scriptUrl);
  return pollMs;
}

export function installGlitchMutableHotfixClient() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  if (window.__biomesGlitchMutableHotfixPollerInstalled) {
    return;
  }
  window.__biomesGlitchMutableHotfixPollerInstalled = true;

  const poll = async () => {
    let pollMs = DEFAULT_POLL_MS;
    try {
      pollMs = await pollGlitchMutableHotfixOnce();
    } catch (error) {
      console.error("Mutable hotfix poll failed", error);
    }
    window.setTimeout(poll, pollMs);
  };
  void poll();
}
