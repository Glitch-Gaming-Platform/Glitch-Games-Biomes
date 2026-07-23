export interface HarthmereRedisReadPrimary {
  get: (key: string) => Promise<string | null>;
  mget?: (...keys: string[]) => Promise<Array<string | null>>;
}

const globalForHarthmereLiveModeReadInflight =
  globalThis as typeof globalThis & {
    __harthmereLiveModeReadInflight?: WeakMap<
      HarthmereRedisReadPrimary,
      Map<string, Promise<Array<string | null>>>
    >;
  };

function harthmereLiveModeReadInflight(primary: HarthmereRedisReadPrimary) {
  const byPrimary =
    (globalForHarthmereLiveModeReadInflight.__harthmereLiveModeReadInflight ??=
      new WeakMap());
  let inflight = byPrimary.get(primary);
  if (!inflight) {
    inflight = new Map();
    byPrimary.set(primary, inflight);
  }
  return inflight;
}

export function harthmereLiveModeReadInflightKey(keys: readonly string[]) {
  return keys.join("\u0000");
}

export async function readHarthmereRedisStrings(
  primary: HarthmereRedisReadPrimary,
  keys: readonly string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) return [];
  // Redis WATCH state is connection-scoped. Coalescing an MGET from a
  // different connection into a watched transaction gives the transaction a
  // stale value that its own WATCH can never detect. Keep coalescing local to
  // the exact primary connection so read-only polling remains cheap without
  // violating transactional authority.
  const inflight = harthmereLiveModeReadInflight(primary);
  const inflightKey = harthmereLiveModeReadInflightKey(keys);
  const existing = inflight.get(inflightKey);
  if (existing) {
    return existing;
  }
  const readPromise = readHarthmereRedisStringsUncached(primary, keys);
  inflight.set(inflightKey, readPromise);
  try {
    return await readPromise;
  } finally {
    if (inflight.get(inflightKey) === readPromise) {
      inflight.delete(inflightKey);
    }
  }
}

async function readHarthmereRedisStringsUncached(
  primary: HarthmereRedisReadPrimary,
  keys: readonly string[]
): Promise<Array<string | null>> {
  if (typeof primary.mget === "function") {
    const values = await primary.mget(...keys);
    return keys.map((_, index) => {
      const value = values[index];
      return typeof value === "string" ? value : null;
    });
  }
  return Promise.all(keys.map((key) => primary.get(key)));
}

export async function readHarthmerePlayerAndSharedStateStrings(
  primary: HarthmereRedisReadPrimary,
  playerStateKey: string,
  sharedStateKey: string
) {
  const [rawState, rawSharedState] = await readHarthmereRedisStrings(
    primary,
    [playerStateKey, sharedStateKey]
  );
  return { rawState, rawSharedState };
}
