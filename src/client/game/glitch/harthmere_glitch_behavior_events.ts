// HARTHMERE_GLITCH_BEHAVIOR_EVENTS_V138
// Small client-only event bus for Glitch behavioral funnel telemetry.
// The network sender lives in harthmere_glitch_bridge.ts so this helper can be
// imported safely by UI/onboarding components without pulling in the full bridge.

export const HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION_V138 =
  "harthmere-glitch-behavior-events-v138" as const;

export const HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME_V138 =
  "biomes:harthmere-glitch-behavior-event-v138" as const;

export type HarthmereGlitchBehaviorMetadataV138 = Record<string, unknown>;

declare global {
  interface Window {
    __harthmereGlitchBehaviorBacklogV138?: HarthmereGlitchBehaviorEventV138[];
  }
}

export interface HarthmereGlitchBehaviorEventV138 {
  version: typeof HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION_V138;
  step_key: string;
  action_key: string;
  metadata?: HarthmereGlitchBehaviorMetadataV138;
  event_timestamp: string;
}

function isBrowserV138() {
  return (
    typeof window !== "undefined" && typeof window.dispatchEvent === "function"
  );
}

function cleanKeyV138(value: string | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function cleanMetadataV138(
  metadata: HarthmereGlitchBehaviorMetadataV138 | undefined
): HarthmereGlitchBehaviorMetadataV138 | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const cleaned: HarthmereGlitchBehaviorMetadataV138 = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 24)) {
    const safeKey = cleanKeyV138(key, "field");
    if (value === undefined || typeof value === "function") {
      continue;
    }
    if (typeof value === "string") {
      cleaned[safeKey] = value.slice(0, 160);
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      cleaned[safeKey] = value;
    } else if (Array.isArray(value)) {
      cleaned[safeKey] = value
        .slice(0, 12)
        .map((entry) =>
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean"
            ? entry
            : String(entry).slice(0, 120)
        );
    } else {
      try {
        cleaned[safeKey] =
          JSON.parse(JSON.stringify(value)).toString?.() ?? value;
      } catch {
        cleaned[safeKey] = String(value).slice(0, 120);
      }
    }
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function makeHarthmereGlitchBehaviorEventV138(
  stepKey: string,
  actionKey = "event",
  metadata?: HarthmereGlitchBehaviorMetadataV138
): HarthmereGlitchBehaviorEventV138 {
  return {
    version: HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION_V138,
    step_key: cleanKeyV138(stepKey, "unknown_step"),
    action_key: cleanKeyV138(actionKey, "event"),
    metadata: cleanMetadataV138(metadata),
    event_timestamp: new Date().toISOString(),
  };
}

export function emitHarthmereGlitchBehaviorEventV138(
  stepKey: string,
  actionKey = "event",
  metadata?: HarthmereGlitchBehaviorMetadataV138
): HarthmereGlitchBehaviorEventV138 | undefined {
  const event = makeHarthmereGlitchBehaviorEventV138(
    stepKey,
    actionKey,
    metadata
  );
  if (!isBrowserV138()) {
    return event;
  }
  try {
    window.__harthmereGlitchBehaviorBacklogV138 = [
      ...(window.__harthmereGlitchBehaviorBacklogV138 ?? []),
      event,
    ].slice(-100);
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME_V138, {
        detail: event,
      })
    );
  } catch {
    // Telemetry is optional. Never let it block gameplay, onboarding, or UI.
  }
  return event;
}
