import { sleep } from "@/shared/util/async";

export type NativeCutsceneActorLoadState = "loading" | "loaded" | "failed";

export interface NativeCutsceneActorLoadStatus {
  id: number;
  asset: string;
  label: string;
  state: NativeCutsceneActorLoadState;
  at: number;
  error?: string;
}

const actorStatuses = new Map<number, NativeCutsceneActorLoadStatus>();

type NativeCutsceneActorReadinessWindow = typeof globalThis & {
  __harthmereNativeCutsceneActorReadiness?: Record<
    string,
    NativeCutsceneActorLoadStatus
  >;
};

function publishDebugSnapshot() {
  if (typeof window === "undefined") {
    return;
  }
  (
    window as NativeCutsceneActorReadinessWindow
  ).__harthmereNativeCutsceneActorReadiness = Object.fromEntries(
    [...actorStatuses.entries()].map(([id, status]) => [String(id), status])
  );
}

export function markNativeCutsceneActorLoading(input: {
  id: number;
  asset: string;
  label: string;
}): void {
  actorStatuses.set(input.id, {
    ...input,
    state: "loading",
    at: Date.now(),
  });
  publishDebugSnapshot();
}

export function markNativeCutsceneActorLoaded(id: number): void {
  const existing = actorStatuses.get(id);
  if (!existing) {
    return;
  }
  actorStatuses.set(id, {
    ...existing,
    state: "loaded",
    at: Date.now(),
    error: undefined,
  });
  publishDebugSnapshot();
}

export function markNativeCutsceneActorFailed(
  id: number,
  error: unknown
): void {
  const existing = actorStatuses.get(id);
  if (!existing) {
    return;
  }
  actorStatuses.set(id, {
    ...existing,
    state: "failed",
    at: Date.now(),
    error: error instanceof Error ? error.message : String(error),
  });
  publishDebugSnapshot();
}

export function clearNativeCutsceneActorReadiness(id: number): void {
  actorStatuses.delete(id);
  publishDebugSnapshot();
}

export function nativeCutsceneActorReadiness(
  id: number
): NativeCutsceneActorLoadStatus | undefined {
  return actorStatuses.get(id);
}

export async function waitForNativeCutsceneActors(
  ids: readonly number[],
  timeoutMs = 30_000
): Promise<void> {
  const required = [...new Set(ids)];
  if (required.length === 0) {
    return;
  }
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const statuses = required.map((id) => actorStatuses.get(id));
    const failed = statuses.find((status) => status?.state === "failed");
    if (failed) {
      throw new Error(
        `cutscene actor ${failed.label} (${failed.asset}) failed to load: ${
          failed.error ?? "unknown error"
        }`
      );
    }
    if (statuses.every((status) => status?.state === "loaded")) {
      return;
    }
    await sleep(25);
  }
  const pending = required.map((id) => {
    const status = actorStatuses.get(id);
    return status
      ? `${status.label}:${status.state}`
      : `${id}:not-observed-by-renderer`;
  });
  throw new Error(
    `cutscene actors did not become visible before capture: ${pending.join(
      ", "
    )}`
  );
}

export function resetNativeCutsceneActorReadinessForTest(): void {
  actorStatuses.clear();
  publishDebugSnapshot();
}
