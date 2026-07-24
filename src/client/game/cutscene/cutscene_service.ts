// HARTHMERE_CUTSCENE_SERVICE
//
// Module-level cutscene front door. Any client code (quest runtime hooks,
// dialogue components, interaction handlers, dev console) can register and
// request cutscenes here without holding a reference to the director script;
// the CutsceneDirectorScript drains requests each tick.
//
// End-state commit hooks are registered here too. They MUST be idempotent:
// the director guards per-instance tokens, but a hook may still be re-run
// after a reconnect replay, so hooks should tolerate duplicates (the same
// rule as every other Harthmere live-mode commit).

import { CutsceneLibrary, CutsceneQueue } from "@/shared/cutscene/library";
import type { CutsceneRequest } from "@/shared/cutscene/library";
import type { CutsceneDef } from "@/shared/cutscene/schema";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import { log } from "@/shared/logging";

export const cutsceneLibrary = new CutsceneLibrary();
export const cutsceneQueue = new CutsceneQueue();

const pendingRequests: CutsceneRequest[] = [];
const MAX_PENDING_REQUESTS = 64;

export type CutsceneHookFn = (payload?: unknown) => void | Promise<void>;
const hooks = new Map<string, CutsceneHookFn>();
const appliedCommitTokens = new Set<string>();
const pendingCommitTokens = new Map<string, Promise<void>>();

/** Register (and validate) a cutscene definition for later triggering by id. */
export function registerCutscene(raw: unknown): CutsceneDef {
  return cutsceneLibrary.register(raw);
}

/** Register a named hook used by `custom` actions and onEnd commits. */
export function registerCutsceneHook(name: string, fn: CutsceneHookFn): void {
  hooks.set(name, fn);
}

export function getCutsceneHook(name: string): CutsceneHookFn | undefined {
  return hooks.get(name);
}

/**
 * Run a complete end-state transaction once per session. A token is marked
 * applied only after the work succeeds; failures remain retryable. Concurrent
 * callers share the same in-flight promise.
 */
export async function runCutsceneCommitOnce(
  token: string,
  work: () => Promise<void>
): Promise<boolean> {
  if (appliedCommitTokens.has(token)) {
    return false;
  }
  const existing = pendingCommitTokens.get(token);
  if (existing) {
    await existing;
    return false;
  }
  const pending = work();
  pendingCommitTokens.set(token, pending);
  try {
    await pending;
    appliedCommitTokens.add(token);
    return true;
  } finally {
    pendingCommitTokens.delete(token);
  }
}

/** Request a registered cutscene by id. Returns false if unknown. */
export function requestCutsceneById(
  id: string,
  opts: { preempt?: boolean } = {}
): boolean {
  const def = cutsceneLibrary.get(id);
  if (!def) {
    log.warn(`requestCutsceneById: unknown cutscene "${id}"`);
    return false;
  }
  if (pendingRequests.length >= MAX_PENDING_REQUESTS) {
    log.warn(`requestCutsceneById: queue is full; dropping "${id}"`);
    return false;
  }
  pendingRequests.push({ def, preempt: opts.preempt });
  return true;
}

/** Validate + request an inline definition (e.g. template output). */
export function requestCutscene(
  raw: unknown,
  opts: { preempt?: boolean } = {}
): boolean {
  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    log.warn(
      `requestCutscene: invalid def: ${result.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ")}`
    );
    return false;
  }
  if (result.def.settings.mode === "serverShared") {
    log.warn(
      "requestCutscene: inline serverShared scenes are forbidden; register a trusted definition first"
    );
    return false;
  }
  if (pendingRequests.length >= MAX_PENDING_REQUESTS) {
    log.warn(`requestCutscene: queue is full; dropping "${result.def.id}"`);
    return false;
  }
  pendingRequests.push({ def: result.def, preempt: opts.preempt });
  return true;
}

/** Drained by the director each tick. */
export function drainCutsceneRequests(): CutsceneRequest[] {
  if (pendingRequests.length === 0) {
    return [];
  }
  return pendingRequests.splice(0, pendingRequests.length);
}

/** Test/teardown helper. */
export function resetCutsceneService(): void {
  pendingRequests.length = 0;
  hooks.clear();
  appliedCommitTokens.clear();
  pendingCommitTokens.clear();
  cutsceneLibrary.clear();
  cutsceneQueue.clear();
}
