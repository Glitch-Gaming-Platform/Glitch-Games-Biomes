import { log } from "@/shared/logging";

export const DEFAULT_ANIMA_NPC_TICK_TIME_MS = 100;
export const DEFAULT_ANIMA_NPC_TICK_DURATION_SECONDS =
  DEFAULT_ANIMA_NPC_TICK_TIME_MS / 1000;

let warnedInvalidTickTime = false;

export function validatedAnimaNpcTickTimeMs(config?: {
  animaNpcTickTimeMs?: number | null;
}): number {
  const configured = config?.animaNpcTickTimeMs;
  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured > 0
  ) {
    return configured;
  }
  return DEFAULT_ANIMA_NPC_TICK_TIME_MS;
}

export function animaNpcTickTimeMs(): number {
  const configured = (
    globalThis as typeof globalThis & {
      CONFIG?: { animaNpcTickTimeMs?: number | null };
    }
  ).CONFIG?.animaNpcTickTimeMs;
  const resolved = validatedAnimaNpcTickTimeMs({
    animaNpcTickTimeMs: configured,
  });
  if (resolved !== configured && !warnedInvalidTickTime) {
    warnedInvalidTickTime = true;
    log.warn("Invalid Anima NPC tick interval; using safe default", {
      configured,
      resolved,
    });
  }
  return resolved;
}

export function animaNpcTickDurationSeconds(): number {
  return animaNpcTickTimeMs() / 1000;
}

export function validatedAnimaNpcTickDurationSeconds(
  durationSeconds: number | undefined
): number {
  return typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
    ? durationSeconds
    : DEFAULT_ANIMA_NPC_TICK_DURATION_SECONDS;
}
