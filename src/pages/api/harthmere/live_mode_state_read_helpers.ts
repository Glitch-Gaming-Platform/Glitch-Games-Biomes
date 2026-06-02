export interface HarthmereRedisReadPrimaryV1 {
  get: (key: string) => Promise<string | null>;
  mget?: (...keys: string[]) => Promise<Array<string | null>>;
}

export async function readHarthmereRedisStringsV1(
  primary: HarthmereRedisReadPrimaryV1,
  keys: readonly string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) return [];
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
