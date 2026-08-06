import { createHash } from "crypto";
import type { GlitchMutableHotfixManifest } from "./mutable_hotfix";

export interface GlitchMutableHotfixClientPayload {
  script?: string;
  scriptBase64?: string;
  style?: string;
  styleBase64?: string;
  reload?: "never" | "on-change";
  expectedSha256?: string;
}

export interface DecodedGlitchMutableHotfixClientPayload {
  script: string;
  style: string;
  reload: "never" | "on-change";
  hash: string;
}

export interface GlitchMutableHotfixClientDescriptor {
  active: true;
  version: string;
  hash: string;
  reload: "never" | "on-change";
  scriptUrl: string;
  pollMs: number;
}

function decodeText(
  label: string,
  text: string | undefined,
  base64: string | undefined
) {
  if (text !== undefined && base64 !== undefined) {
    throw new Error(`mutable_hotfix_client_invalid:${label}_has_two_sources`);
  }
  if (base64 !== undefined) {
    return Buffer.from(base64, "base64").toString("utf8");
  }
  return text ?? "";
}

export function decodeGlitchMutableHotfixClientPayload(
  manifest: GlitchMutableHotfixManifest
): DecodedGlitchMutableHotfixClientPayload | undefined {
  if (!manifest.client) {
    return undefined;
  }
  const script = decodeText(
    "script",
    manifest.client.script,
    manifest.client.scriptBase64
  );
  const style = decodeText(
    "style",
    manifest.client.style,
    manifest.client.styleBase64
  );
  if (!script && !style) {
    throw new Error("mutable_hotfix_client_invalid:empty");
  }
  const reload = manifest.client.reload ?? "never";
  if (reload !== "never" && reload !== "on-change") {
    throw new Error("mutable_hotfix_client_invalid:reload");
  }
  const hash = createHash("sha256")
    .update(JSON.stringify({ script, style, reload }))
    .digest("hex");
  if (
    manifest.client.expectedSha256 !== undefined &&
    manifest.client.expectedSha256 !== hash
  ) {
    throw new Error(
      `mutable_hotfix_client_hash_mismatch:expected_${manifest.client.expectedSha256}:actual_${hash}`
    );
  }
  return { script, style, reload, hash };
}

export function glitchMutableHotfixClientDescriptor(
  manifest: GlitchMutableHotfixManifest,
  endpoint = "/api/mutable_hotfix"
): GlitchMutableHotfixClientDescriptor | undefined {
  const payload = decodeGlitchMutableHotfixClientPayload(manifest);
  if (!payload) {
    return undefined;
  }
  const params = new URLSearchParams({
    asset: "script",
    version: manifest.version,
    hash: payload.hash,
  });
  return {
    active: true,
    version: manifest.version,
    hash: payload.hash,
    reload: payload.reload,
    scriptUrl: `${endpoint}?${params.toString()}`,
    pollMs: 5_000,
  };
}

export function renderGlitchMutableHotfixClientScript(
  manifest: GlitchMutableHotfixManifest
) {
  const payload = decodeGlitchMutableHotfixClientPayload(manifest);
  if (!payload) {
    return "/* No active Glitch mutable client hotfix. */\n";
  }

  const version = JSON.stringify(manifest.version);
  const hash = JSON.stringify(payload.hash);
  const style = JSON.stringify(payload.style);
  return `(() => {
  const VERSION = ${version};
  const HASH = ${hash};
  const STYLE = ${style};
  const STYLE_ID = "biomes-glitch-mutable-hotfix-style";
  const previous = window.__biomesGlitchMutableHotfix;
  if (previous?.hash === HASH) return;

  const priorStyle = document.getElementById(STYLE_ID);
  const priorStyleText = priorStyle?.textContent ?? "";
  let styleElement = priorStyle;
  if (STYLE) {
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = STYLE;
  } else if (styleElement) {
    styleElement.remove();
    styleElement = null;
  }

  let cleanup;
  const state = {
    version: VERSION,
    hash: HASH,
    registerCleanup(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("Mutable hotfix cleanup must be a function");
      }
      cleanup = fn;
      state.cleanup = fn;
    },
  };
  window.__biomesGlitchMutableHotfix = state;

  try {
    (() => {
${payload.script}
    })();
  } catch (error) {
    if (styleElement) {
      if (priorStyle) {
        styleElement.textContent = priorStyleText;
      } else {
        styleElement.remove();
      }
    } else if (priorStyle) {
      priorStyle.textContent = priorStyleText;
      document.head.appendChild(priorStyle);
    }
    window.__biomesGlitchMutableHotfix = previous;
    throw error;
  }

  try {
    previous?.cleanup?.();
  } catch (error) {
    console.error("Previous mutable hotfix cleanup failed", error);
  }
  window.dispatchEvent(new CustomEvent("biomes:mutable-hotfix-applied", {
    detail: { version: VERSION, hash: HASH },
  }));
})();
//# sourceURL=biomes-mutable-hotfix-${manifest.version}.js
`;
}
