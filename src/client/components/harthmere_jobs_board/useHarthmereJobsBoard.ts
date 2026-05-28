import * as React from "react";
import { fetchHarthmereJobsBoardStateV1, type HarthmereJobsBoardSnapshotV1 } from "./jobsBoardLiveAdapter";

export function useHarthmereJobsBoard(fetchImpl?: typeof fetch) {
  const [state, setState] = React.useState<HarthmereJobsBoardSnapshotV1 | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setState(await fetchHarthmereJobsBoardStateV1(fetchImpl));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchImpl]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  return { state, loading, error, refresh };
}
