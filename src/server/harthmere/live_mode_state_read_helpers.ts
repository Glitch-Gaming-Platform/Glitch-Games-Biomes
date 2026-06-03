export interface HarthmereRedisReadPrimaryV1 {
  get: (key: string) => Promise<string | null>;
  mget?: (...keys: string[]) => Promise<Array<string | null>>;
}

const globalForHarthmereLiveModeReadInflightV1 =
  globalThis as typeof globalThis & {
    __harthmereLiveModeReadInflightV1?: Map<
      string,
      Promise<Array<string | null>>
    >;
  };

function harthmereLiveModeReadInflightV1() {
  return (globalForHarthmereLiveModeReadInflightV1.__harthmereLiveModeReadInflightV1 ??=
    new Map());
}

export function harthmereLiveModeReadInflightKeyV1(keys: readonly string[]) {
  return keys.join("\u0000");
}

export async function readHarthmereRedisStringsV1(
  primary: HarthmereRedisReadPrimaryV1,
  keys: readonly string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) return [];
  const inflight = harthmereLiveModeReadInflightV1();
  const inflightKey = harthmereLiveModeReadInflightKeyV1(keys);
  const existing = inflight.get(inflightKey);
  if (existing) {
    return existing;
  }
  const readPromise = readHarthmereRedisStringsUncachedV1(primary, keys);
  inflight.set(inflightKey, readPromise);
  try {
    return await readPromise;
  } finally {
    if (inflight.get(inflightKey) === readPromise) {
      inflight.delete(inflightKey);
    }
  }
}

async function readHarthmereRedisStringsUncachedV1(
  primary: HarthmereRedisReadPrimaryV1,
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

export async function readHarthmerePlayerAndSharedStateStringsV1(
  primary: HarthmereRedisReadPrimaryV1,
  playerStateKey: string,
  sharedStateKey: string
) {
  const [rawState, rawSharedState] = await readHarthmereRedisStringsV1(
    primary,
    [playerStateKey, sharedStateKey]
  );
  return { rawState, rawSharedState };
}
