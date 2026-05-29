// HARTHMERE_JOBS_BOARD_LIVE_CONTAINER_V141:
// Wires the live `/api/harthmere/live_mode_jobs_board_state` adapter and the
// `/api/harthmere/live_mode` mutation pipeline into HarthmereJobsBoardPanel.
// There is NO dummy data anywhere in this container — every render reflects
// the actual server-authoritative snapshot fetched via
// `useHarthmereJobsBoard`. Mutations (accept / complete / cancel / post) flow
// through `createHarthmereJobsBoardAdapterV1`, and the snapshot returned from
// each mutation replaces the local state immediately so the UI never lies
// about what the server believes.
//
// Mount this container directly — it owns its own fetch, error, and refresh
// states. Closing it via `onClose` is the only required outer wiring.
import * as React from "react";
import {
  createHarthmereJobsBoardAdapterV1,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  listHarthmereJobsBoardWayfindingHintsV141,
  nearestPhysicalHarthmereJobsBoardIdV141,
  type HarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardWorldContextV1,
} from "./jobsBoardLiveAdapter";
import { useHarthmereJobsBoard } from "./useHarthmereJobsBoard";
import { HarthmereJobsBoardPanel } from "./HarthmereJobsBoardPanel";

// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
// Mirrors the authority module's constants. Hardcoded here so the container
// doesn't pull a server-only import on the client bundle. Kept in lockstep
// via the test in __tests__/jobsBoardBoardSelector.test.ts.
export const HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_CLIENT_V141 = "harthmere_town_market_jobs_board" as const;

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE_V141:
// The container takes a `worldContext` describing where the player is so it
// can refuse to render the jobs list when the player isn't physically at a
// board. Tests and the HUD pass `{ playerPosition: { x, y, z } }`; the prompt
// component can pass `{ nearbyBoardId }` when the player walks into a board's
// interactable radius. If no worldContext is supplied at all (callers that
// don't know yet), the container falls back to the bypass behavior so the
// existing test suite stays green.
export function HarthmereJobsBoardLiveContainerV141({
  boardId,
  worldContext,
  onClose,
}: {
  boardId?: string;
  worldContext?: HarthmereJobsBoardWorldContextV1;
  onClose?: () => void;
}) {
  const { state, loading, error, refresh } = useHarthmereJobsBoard();
  const [snapshot, setSnapshot] = React.useState<HarthmereJobsBoardSnapshotV1 | undefined>();
  const [mutationError, setMutationError] = React.useState<string | undefined>();
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
  // Board selector — defaults to the Grove board but lets the player switch
  // to the Harthmere board without leaving the panel. If the caller passes a
  // `boardId` prop, that wins (e.g. proximity-based opening at a specific
  // physical board).
  const [activeBoardId, setActiveBoardId] = React.useState<string>(boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
  React.useEffect(() => {
    if (boardId) setActiveBoardId(boardId);
  }, [boardId]);

  // The fetcher publishes to `state`; mirror it into local `snapshot` so the
  // mutation path can also replace it without round-tripping the fetcher.
  React.useEffect(() => {
    if (state) setSnapshot(state);
  }, [state]);

  const adapter = React.useMemo(() => createHarthmereJobsBoardAdapterV1(), []);

  const run = React.useCallback(
    async (op: () => Promise<HarthmereJobsBoardSnapshotV1>) => {
      setMutationError(undefined);
      try {
        const next = await op();
        setSnapshot(next);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const onAcceptJob = React.useCallback(
    (jobId: string) => run(() => adapter.acceptJob(jobId, activeBoardId)),
    [adapter, activeBoardId, run],
  );
  const onCompleteJob = React.useCallback(
    (jobId: string) => run(() => adapter.completeJob(jobId, activeBoardId)),
    [adapter, activeBoardId, run],
  );
  const onCancelJob = React.useCallback(
    (jobId: string) => run(() => adapter.cancelJob(jobId, activeBoardId)),
    [adapter, activeBoardId, run],
  );
  // Post requires a payload from the user. The bare button in the panel kicks
  // off a refresh today; richer composition (form) can land on top of this
  // container without changing the panel contract.
  const onPostJob = React.useCallback(() => {
    void refresh();
  }, [refresh]);

  if (!snapshot) {
    return (
      <div className="harthmere-jobs-board__backdrop" role="dialog" aria-modal="true">
        <section className="harthmere-jobs-board">
          <header className="harthmere-jobs-board__header">
            <div>
              <h2>Jobs Board</h2>
              <p>{loading ? "Loading live board state…" : (error ?? mutationError) ? "Could not reach the jobs board." : "Connecting…"}</p>
            </div>
            <button onClick={onClose} aria-label="Close jobs board">×</button>
          </header>
          <main className="harthmere-jobs-board__content">
            <div className="harthmere-jobs-board__status" data-state={error || mutationError ? "error" : "info"}>
              <span>{error || mutationError || (loading ? "Fetching jobs from the live backend…" : "Waiting for backend response.")}</span>
              <button type="button" onClick={() => void refresh()} disabled={loading}>
                Retry
              </button>
            </div>
          </main>
        </section>
      </div>
    );
  }

  const statusLine = mutationError
    ? mutationError
    : error
      ? error
      : loading
        ? "Refreshing from live backend…"
        : `Live · ${snapshot.openJobs.length} open · ${snapshot.myAcceptedJobs.length} accepted by you`;

  // HARTHMERE_JOBS_BOARD_PROXIMITY_GATE_V141:
  // The player must be physically at a board (either via interaction prompt,
  // nearbyBoardId set, or world position inside the board radius). If they
  // aren't, render a "go to the nearest board" notice with wayfinding hints
  // instead of the jobs list. Passing no `worldContext` keeps the legacy
  // behavior (open the panel anyway) so older callers and existing tests
  // are unaffected — only the new HUD wiring passes worldContext.
  if (worldContext) {
    const physicalBoardId = nearestPhysicalHarthmereJobsBoardIdV141(snapshot, worldContext);
    if (!physicalBoardId) {
      const hints = listHarthmereJobsBoardWayfindingHintsV141(snapshot, worldContext);
      return (
        <div
          className="harthmere-jobs-board__backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <section className="harthmere-jobs-board" data-testid="harthmere-jobs-board-proximity-prompt">
            <header className="harthmere-jobs-board__header">
              <div>
                <h2>Walk to a Jobs Board</h2>
                <p>You must be standing at a physical board to read or post jobs.</p>
              </div>
              <button onClick={onClose} aria-label="Close jobs board">×</button>
            </header>
            <main className="harthmere-jobs-board__content">
              {hints.length === 0 ? (
                <p className="empty">No jobs boards are registered yet.</p>
              ) : (
                <div className="harthmere-jobs-grid" data-testid="harthmere-jobs-board-wayfinding">
                  {hints.map((hint) => (
                    <article className="harthmere-jobs-card" key={hint.boardId}>
                      <strong>{hint.displayName}</strong>
                      <span>{hint.district}</span>
                      <small>
                        {Number.isFinite(hint.approxDistanceMeters)
                          ? `${hint.approxDistanceMeters}m away · world ${Math.round(hint.position.x)}, ${Math.round(hint.position.z)}`
                          : `World ${Math.round(hint.position.x)}, ${Math.round(hint.position.z)}`}
                      </small>
                      <em>Open the map (M) and follow the marker to this board.</em>
                    </article>
                  ))}
                </div>
              )}
            </main>
          </section>
        </div>
      );
    }
    // Player IS at a board — sync the active board to the one they're near
    // (unless they explicitly picked a different one via the selector).
    if (!boardId && activeBoardId !== physicalBoardId && Object.keys(snapshot.boards ?? {}).length > 0) {
      // Don't overwrite explicit selector picks — the chip handler stays the
      // source of truth for in-panel switching. Only set the default once.
      if (activeBoardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1) {
        // Defer through an effect to avoid setting state during render.
        // We're inside a render branch, so schedule asynchronously.
        queueMicrotask(() => setActiveBoardId(physicalBoardId));
      }
    }
  }

  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
  // Board switcher — one chip per registered board. The snapshot already
  // carries the registry (boards + defaultBoardId), so we render whatever
  // the backend returned and don't have to hardcode names beyond labels.
  const boardChoices = Object.values(snapshot.boards ?? {});
  return (
    <div className="harthmere-jobs-board__live-wrapper">
      {boardChoices.length > 1 && (
        <div
          className="harthmere-jobs-board__board-selector"
          role="tablist"
          aria-label="Choose a jobs board"
          data-testid="harthmere-jobs-board-selector"
          style={{
            position: "fixed",
            top: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            gap: "0.4rem",
            padding: "0.35rem 0.5rem",
            background: "rgba(8, 14, 32, 0.92)",
            border: "1px solid rgba(74, 222, 255, 0.35)",
            borderRadius: 999,
            maxWidth: "calc(100vw - 1.5rem)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {boardChoices.map((board) => {
            const isActive = activeBoardId === board.boardId;
            return (
              <button
                key={board.boardId}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`harthmere-jobs-board-tab-${board.boardId}`}
                onClick={() => setActiveBoardId(board.boardId)}
                style={{
                  appearance: "none",
                  padding: "0.4rem 0.85rem",
                  background: isActive ? "rgba(74, 222, 255, 0.22)" : "rgba(13, 22, 44, 0.6)",
                  color: isActive ? "rgb(232, 244, 255)" : "rgba(232, 244, 255, 0.7)",
                  border: isActive ? "1px solid rgba(74, 222, 255, 0.85)" : "1px solid rgba(74, 222, 255, 0.25)",
                  borderRadius: 999,
                  font: "inherit",
                  fontSize: "0.72rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {board.displayName}
              </button>
            );
          })}
        </div>
      )}
      <HarthmereJobsBoardPanel
        snapshot={snapshot}
        boardId={activeBoardId}
        onAcceptJob={onAcceptJob}
        onCompleteJob={onCompleteJob}
        onCancelJob={onCancelJob}
        onPostJob={onPostJob}
        onClose={onClose}
      />
      {/* Status overlay sits inside the same modal stack; the panel exposes a
          dedicated status row via the .harthmere-jobs-board__status styles. */}
      <div className="harthmere-jobs-board__status-overlay" aria-live="polite">
        <div
          className="harthmere-jobs-board__status"
          data-state={mutationError || error ? "error" : "info"}
          style={{
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(8, 14, 32, 0.92)",
            border: "1px solid rgba(74, 222, 255, 0.35)",
            borderRadius: "999px",
            padding: "0.4rem 0.9rem",
            zIndex: 60,
            margin: 0,
            maxWidth: "calc(100vw - 1.5rem)",
          }}
        >
          <span>{statusLine}</span>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
