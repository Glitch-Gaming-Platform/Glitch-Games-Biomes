export interface HarthmereRedisReadPrimary {
  get: (key: string) => Promise<string | null>;
  mget?: (...keys: string[]) => Promise<Array<string | null>>;
}

const globalForHarthmereLiveModeReadInflight =
  globalThis as typeof globalThis & {
    __harthmereLiveModeReadInflight?: Map<
      string,
      Promise<Array<string | null>>
    >;
  };

function harthmereLiveModeReadInflight() {
  return (globalForHarthmereLiveModeReadInflight.__harthmereLiveModeReadInflight ??=
    new Map());
}

export function harthmereLiveModeReadInflightKey(keys: readonly string[]) {
  return keys.join("\u0000");
}

export async function readHarthmereRedisStrings(
  primary: HarthmereRedisReadPrimary,
  keys: readonly string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) return [];
  const inflight = harthmereLiveModeReadInflight();
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
