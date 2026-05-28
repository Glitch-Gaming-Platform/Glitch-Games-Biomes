import * as React from "react";
import {
  createHarthmereBusinessInterfaceAdapterV1,
  fetchHarthmereBusinessEconomyStateV1,
  submitHarthmereBusinessEconomyMutationV1,
  type HarthmereBusinessEconomySnapshotV1,
  type HarthmereBusinessInterfaceAdapterV1,
} from "./businessInterfaceLiveAdapter";

export interface UseHarthmereBusinessInterfaceOptionsV1 {
  nearbyBusinessId?: string | null;
  enabled?: boolean;
  refreshMs?: number;
}

export function useHarthmereBusinessInterfaceAdapterV1(
  options: UseHarthmereBusinessInterfaceOptionsV1 = {},
): {
  adapter: HarthmereBusinessInterfaceAdapterV1;
  state: HarthmereBusinessEconomySnapshotV1 | undefined;
  hydrated: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
} {
  const { nearbyBusinessId, enabled = true, refreshMs = 5000 } = options;
  const [state, setState] = React.useState<HarthmereBusinessEconomySnapshotV1 | undefined>();
  const [hydrated, setHydrated] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>();

  const refresh = React.useCallback(async () => {
    if (!enabled || !nearbyBusinessId) return;
    try {
      const next = await fetchHarthmereBusinessEconomyStateV1();
      setState(next);
      setHydrated(true);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setHydrated(false);
    }
  }, [enabled, nearbyBusinessId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!enabled || !nearbyBusinessId || refreshMs <= 0) return;
    const handle = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(handle);
  }, [enabled, nearbyBusinessId, refresh, refreshMs]);

  const adapter = React.useMemo(
    () =>
      createHarthmereBusinessInterfaceAdapterV1({
        state,
        hydrated,
        setState,
        refresh: async () => {
          const next = await fetchHarthmereBusinessEconomyStateV1();
          setState(next);
          setHydrated(true);
          return next;
        },
        submit: (operation, payload) => submitHarthmereBusinessEconomyMutationV1(operation, payload),
      }),
    [state, hydrated],
  );

  return { adapter, state, hydrated, error, refresh };
}
