// HARTHMERE_GLITCH_BEHAVIOR_EVENTS
// Small client-only event bus for Glitch behavioral funnel telemetry.
// The network sender lives in harthmere_glitch_bridge.ts so this helper can be
// imported safely by UI/onboarding components without pulling in the full bridge.

export const HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION =
  "harthmere-glitch-behavior-events" as const;

export const HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME =
  "biomes:harthmere-glitch-behavior-event" as const;

export type HarthmereGlitchBehaviorMetadata = Record<string, unknown>;

declare global {
  interface Window {
    __harthmereGlitchBehaviorBacklog?: HarthmereGlitchBehaviorEvent[];
  }
}

export interface HarthmereGlitchBehaviorEvent {
  version: typeof HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION;
  step_key: string;
  action_key: string;
  metadata?: HarthmereGlitchBehaviorMetadata;
  event_timestamp: string;
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.dispatchEvent === "function"
  );
}

function cleanKey(value: string | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function cleanMetadata(
  metadata: HarthmereGlitchBehaviorMetadata | undefined
): HarthmereGlitchBehaviorMetadata | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const cleaned: HarthmereGlitchBehaviorMetadata = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 24)) {
    const safeKey = cleanKey(key, "field");
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

export function makeHarthmereGlitchBehaviorEvent(
  stepKey: string,
  actionKey = "event",
  metadata?: HarthmereGlitchBehaviorMetadata
): HarthmereGlitchBehaviorEvent {
  return {
    version: HARTHMERE_GLITCH_BEHAVIOR_EVENT_VERSION,
    step_key: cleanKey(stepKey, "unknown_step"),
    action_key: cleanKey(actionKey, "event"),
    metadata: cleanMetadata(metadata),
    event_timestamp: new Date().toISOString(),
  };
}

export function emitHarthmereGlitchBehaviorEvent(
  stepKey: string,
  actionKey = "event",
  metadata?: HarthmereGlitchBehaviorMetadata
): HarthmereGlitchBehaviorEvent | undefined {
  const event = makeHarthmereGlitchBehaviorEvent(
    stepKey,
    actionKey,
    metadata
  );
  if (!isBrowser()) {
    return event;
  }
  try {
    window.__harthmereGlitchBehaviorBacklog = [
      ...(window.__harthmereGlitchBehaviorBacklog ?? []),
      event,
    ].slice(-100);
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME, {
        detail: event,
      })
    );
  } catch {
    // Telemetry is optional. Never let it block gameplay, onboarding, or UI.
  }
  return event;
}
