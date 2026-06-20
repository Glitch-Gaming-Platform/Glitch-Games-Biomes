import * as React from "react";
import {
  createHarthmereBusinessInterfaceAdapter,
  fetchHarthmereBusinessEconomyState,
  submitHarthmereBusinessEconomyMutation,
  type HarthmereBusinessEconomySnapshot,
  type HarthmereBusinessInterfaceAdapter,
} from "./businessInterfaceLiveAdapter";

export interface UseHarthmereBusinessInterfaceOptions {
  nearbyBusinessId?: string | null;
  enabled?: boolean;
  refreshMs?: number;
}

export function useHarthmereBusinessInterfaceAdapter(
  options: UseHarthmereBusinessInterfaceOptions = {},
): {
  adapter: HarthmereBusinessInterfaceAdapter;
  state: HarthmereBusinessEconomySnapshot | undefined;
  hydrated: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
} {
  const { nearbyBusinessId, enabled = true, refreshMs = 5000 } = options;
  const [state, setState] = React.useState<HarthmereBusinessEconomySnapshot | undefined>();
  const [hydrated, setHydrated] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>();
  const refreshInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!enabled || !nearbyBusinessId) return;
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const next = await fetchHarthmereBusinessEconomyState();
      setState(next);
      setHydrated(true);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setHydrated(false);
    } finally {
      refreshInFlight.current = false;
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
      createHarthmereBusinessInterfaceAdapter({
        state,
        hydrated,
        setState,
        refresh: async () => {
          const next = await fetchHarthmereBusinessEconomyState();
          setState(next);
          setHydrated(true);
          return next;
        },
        submit: (operation, payload) => submitHarthmereBusinessEconomyMutation(operation, payload),
      }),
    [state, hydrated],
  );

  return { adapter, state, hydrated, error, refresh };
}
