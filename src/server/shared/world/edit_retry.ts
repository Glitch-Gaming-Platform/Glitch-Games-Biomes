import type { WorldApi } from "@/server/shared/world/api";
import {
  WorldEditConflictError,
  type WorldEditor,
} from "@/server/shared/world/editor";

export interface WorldEditRetryOptions {
  maxAttempts?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  onConflict?: (input: {
    attempt: number;
    maxAttempts: number;
    error: unknown;
  }) => void;
}

export const DEFAULT_WORLD_EDIT_MAX_ATTEMPTS = 16;

export function isWorldEditConflict(error: unknown) {
  return (
    error instanceof WorldEditConflictError ||
    (error instanceof Error &&
      error.message.includes("Failed to apply change to world"))
  );
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function retryDelayMs(
  attempt: number,
  minDelayMs: number,
  maxDelayMs: number,
  random: () => number
) {
  if (maxDelayMs <= 0) return 0;
  const ceiling = Math.min(
    maxDelayMs,
    Math.max(minDelayMs, minDelayMs * 2 ** Math.max(0, attempt - 1))
  );
  const floor = Math.min(ceiling, Math.max(0, Math.floor(ceiling / 2)));
  return Math.floor(
    floor + Math.max(0, Math.min(1, random())) * (ceiling - floor)
  );
}

/**
 * Rebuilds an optimistic WorldEditor transaction from fresh ECS state after a
 * conflict. Callbacks must contain only repeatable ECS reads/mutations; perform
 * external side effects before or after this helper.
 */
export async function editWorldWithRetry<T>(
  worldApi: Pick<WorldApi, "edit">,
  operation: (editor: WorldEditor, attempt: number) => Promise<T> | T,
  options: WorldEditRetryOptions = {}
) {
  const maxAttempts = Math.max(
    1,
    Math.trunc(options.maxAttempts ?? DEFAULT_WORLD_EDIT_MAX_ATTEMPTS)
  );
  const minDelayMs = Math.max(0, Math.trunc(options.minDelayMs ?? 10));
  const maxDelayMs = Math.max(
    minDelayMs,
    Math.trunc(options.maxDelayMs ?? 250)
  );
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  let lastConflict: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const editor = worldApi.edit();
    try {
      const result = await operation(editor, attempt);
      await editor.commit();
      return result;
    } catch (error) {
      if (!isWorldEditConflict(error)) {
        throw error;
      }
      lastConflict = error;
      options.onConflict?.({ attempt, maxAttempts, error });
      if (attempt < maxAttempts) {
        const delayMs = retryDelayMs(attempt, minDelayMs, maxDelayMs, random);
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }
  }

  throw lastConflict;
}
