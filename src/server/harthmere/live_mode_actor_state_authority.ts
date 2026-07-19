import { generateNonce } from "@/server/shared/nonce";
import { sleep } from "@/shared/util/async";

export const HARTHMERE_LIVE_MODE_ACTOR_LOCK_PREFIX =
  "harthmere:live_mode:current:actor_lock:" as const;

const RELEASE_ACTOR_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const COMPARE_AND_SET_ACTOR_STATE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2])
  return 1
end
return 0
`;

export interface HarthmereActorStateAuthorityRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  eval?: (
    script: string,
    numberOfKeys: number,
    ...args: Array<string | number>
  ) => Promise<unknown>;
}

export function harthmereLiveModeActorLockKey(actorId: string) {
  return `${HARTHMERE_LIVE_MODE_ACTOR_LOCK_PREFIX}${actorId}`;
}

export function supportsHarthmereActorStateAuthority(
  redis: Pick<HarthmereActorStateAuthorityRedis, "set" | "eval">
) {
  return typeof redis.set === "function" && typeof redis.eval === "function";
}

export interface HarthmereActorStateLock {
  acquired: boolean;
  supported: boolean;
  waitedMs: number;
  release(): Promise<void>;
}

/**
 * Cross-replica actor mutex for the single JSON document that backs a
 * Harthmere player. The token-checked Lua release prevents an expired holder
 * from deleting a newer request's lock.
 */
export async function acquireHarthmereActorStateLock(
  redis: HarthmereActorStateAuthorityRedis,
  actorId: string,
  options: {
    waitMs?: number;
    ttlMs?: number;
    retryMs?: number;
    nowMs?: () => number;
    random?: () => number;
  } = {}
): Promise<HarthmereActorStateLock> {
  const startedAt = (options.nowMs ?? Date.now)();
  if (!supportsHarthmereActorStateAuthority(redis)) {
    return {
      acquired: true,
      supported: false,
      waitedMs: 0,
      release: async () => {},
    };
  }

  const nowMs = options.nowMs ?? Date.now;
  const random = options.random ?? Math.random;
  const waitMs = Math.max(0, options.waitMs ?? 20_000);
  const ttlMs = Math.max(1_000, options.ttlMs ?? 45_000);
  const retryMs = Math.max(5, options.retryMs ?? 25);
  const deadline = startedAt + waitMs;
  const lockKey = harthmereLiveModeActorLockKey(actorId);
  const token = `${generateNonce()}-${startedAt}-${random()
    .toString(36)
    .slice(2)}`;

  while (true) {
    const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
    if (result === "OK") {
      let released = false;
      return {
        acquired: true,
        supported: true,
        waitedMs: Math.max(0, nowMs() - startedAt),
        release: async () => {
          if (released) return;
          released = true;
          await redis.eval!(RELEASE_ACTOR_LOCK_LUA, 1, lockKey, token);
        },
      };
    }
    const now = nowMs();
    if (now >= deadline) {
      return {
        acquired: false,
        supported: true,
        waitedMs: Math.max(0, now - startedAt),
        release: async () => {},
      };
    }
    const jitteredRetryMs = retryMs + Math.floor(random() * retryMs);
    await sleep(Math.min(jitteredRetryMs, Math.max(1, deadline - now)));
  }
}

/**
 * Atomically replaces an actor document only when it is still byte-for-byte
 * the state the caller reduced. This is the rolling-deploy safety net for old
 * replicas that do not yet participate in the actor lock.
 */
export async function compareAndSetHarthmereActorState(
  redis: HarthmereActorStateAuthorityRedis,
  key: string,
  expectedRawState: string,
  nextRawState: string
) {
  if (typeof redis.eval !== "function") {
    await redis.set(key, nextRawState);
    return true;
  }
  const result = await redis.eval(
    COMPARE_AND_SET_ACTOR_STATE_LUA,
    1,
    key,
    expectedRawState,
    nextRawState
  );
  return Number(result) === 1;
}
