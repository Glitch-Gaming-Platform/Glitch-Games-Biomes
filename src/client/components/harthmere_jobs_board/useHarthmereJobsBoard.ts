import * as React from "react";
import {
  HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
  cachedHarthmereJobsBoardState,
  fetchHarthmereJobsBoardState,
  harthmereJobsBoardStateFromUpdatedEventDetail,
  normalizeHarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardSnapshot,
} from "./jobsBoardLiveAdapter";

export function useHarthmereJobsBoard(fetchImpl?: typeof fetch) {
  const activeFetch = fetchImpl ?? fetch;
  const [state, setState] = React.useState<
    HarthmereJobsBoardSnapshot | undefined
  >(() => cachedHarthmereJobsBoardState(activeFetch));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const load = React.useCallback(
    async (force = false) => {
      setLoading(true);
      setError(undefined);
      try {
        setState(await fetchHarthmereJobsBoardState(activeFetch, { force }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [activeFetch]
  );
  const refresh = React.useCallback(() => load(true), [load]);
  React.useEffect(() => {
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setState(
        normalizeHarthmereJobsBoardSnapshot(
          harthmereJobsBoardStateFromUpdatedEventDetail(detail)
        )
      );
      setError(undefined);
    };
    window.addEventListener(
      HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
      handleUpdated
    );
    void load(false);
    return () =>
      window.removeEventListener(
        HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
        handleUpdated
      );
  }, [load]);
  return { state, loading, error, refresh };
}
