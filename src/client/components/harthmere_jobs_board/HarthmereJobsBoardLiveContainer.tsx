// HARTHMERE_JOBS_BOARD_LIVE_CONTAINER:
// Wires the live `/api/harthmere/live_mode_jobs_board_state` adapter and the
// `/api/harthmere/live_mode` mutation pipeline into HarthmereJobsBoardPanel.
// There is NO dummy data anywhere in this container — every render reflects
// the actual server-authoritative snapshot fetched via
// `useHarthmereJobsBoard`. Mutations (accept / complete / cancel / post) flow
// through `createHarthmereJobsBoardAdapter`, and the snapshot returned from
// each mutation replaces the local state immediately so the UI never lies
// about what the server believes.
//
// Mount this container directly — it owns its own fetch, error, and refresh
// states. Closing it via `onClose` is the only required outer wiring.
import * as React from "react";
import {
  createHarthmereJobsBoardAdapter,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  listHarthmereJobsBoardWayfindingHints,
  nearestPhysicalHarthmereJobsBoardId,
  type HarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardWorldContext,
} from "./jobsBoardLiveAdapter";
import { useHarthmereJobsBoard } from "./useHarthmereJobsBoard";
import { HarthmereJobsBoardPanel } from "./HarthmereJobsBoardPanel";
import {
  grantHarthmereJobReward,
  harthmereInventoryCanAcceptItems,
  isHarthmereRepairToolEquipped,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
// Mirrors the authority module's constants. Hardcoded here so the container
// doesn't pull a server-only import on the client bundle. Kept in lockstep
// via the test in __tests__/jobsBoardBoardSelector.test.ts.
export const HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_CLIENT = "harthmere_town_market_jobs_board" as const;

const completedDailyTasksForSession = new Set<string>();

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE:
// The container takes a `worldContext` describing where the player is so it
// can refuse to render the jobs list when the player isn't physically at a
// board. Tests and the HUD pass `{ playerPosition: { x, y, z } }`; the prompt
// component can pass `{ nearbyBoardId }` when the player walks into a board's
// interactable radius. If no worldContext is supplied at all (callers that
// don't know yet), the container falls back to the bypass behavior so the
// existing test suite stays green.
export function HarthmereJobsBoardLiveContainer({
  boardId,
  worldContext,
  onClose,
}: {
  boardId?: string;
  worldContext?: HarthmereJobsBoardWorldContext;
  onClose?: () => void;
}) {
  const { state, loading, error, refresh } = useHarthmereJobsBoard();
  const [snapshot, setSnapshot] = React.useState<HarthmereJobsBoardSnapshot | undefined>();
  const [mutationError, setMutationError] = React.useState<string | undefined>();
  const [pendingActionId, setPendingActionId] = React.useState<string | undefined>();

  // The fetcher publishes to `state`; mirror it into local `snapshot` so the
  // mutation path can also replace it without round-tripping the fetcher.
  React.useEffect(() => {
    if (state) setSnapshot(state);
  }, [state]);

  const adapter = React.useMemo(() => createHarthmereJobsBoardAdapter(), []);

  React.useEffect(() => {
    if (!snapshot) return;
    const physicalBoardId = worldContext ? nearestPhysicalHarthmereJobsBoardId(snapshot, worldContext) : snapshot.defaultBoardId;
    if (!physicalBoardId) return;
    const taskId = "jobs_board";
    if (completedDailyTasksForSession.has(taskId)) return;
    completedDailyTasksForSession.add(taskId);
    void adapter.completeDailyTask(taskId).catch(() => {
      completedDailyTasksForSession.delete(taskId);
    });
  }, [adapter, snapshot, worldContext]);

  const physicalBoardId = React.useMemo(
    () =>
      worldContext
        ? nearestPhysicalHarthmereJobsBoardId(snapshot, worldContext)
        : undefined,
    [snapshot, worldContext],
  );
  const activeBoardId =
    boardId ??
    physicalBoardId ??
    snapshot?.defaultBoardId ??
    HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;

  const run = React.useCallback(
    async (actionId: string, op: () => Promise<HarthmereJobsBoardSnapshot>) => {
      if (pendingActionId) return;
      setMutationError(undefined);
      setPendingActionId(actionId);
      try {
        const next = await op();
        setSnapshot(next);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : String(err));
      } finally {
        setPendingActionId(undefined);
      }
    },
    [pendingActionId],
  );

  const onAcceptJob = React.useCallback(
    (jobId: string) =>
      run(`accept:${jobId}`, () => adapter.acceptJob(jobId, activeBoardId)),
    [adapter, activeBoardId, run],
  );
  const onCompleteJob = React.useCallback(
    (jobId: string) => {
      // Two-step completion: verify the work (consume items / check target)
      // then claim the payout. The current todo status decides whether the
      // verification step is still needed.
      const todo = snapshot?.myTodos.find((entry) => entry.jobId === jobId);
      // HARTHMERE_REPAIR_TOOL_COMPLETION: report the repair tool as used
      // when it is equipped, so the server completes a repair-gated job (and
      // otherwise rejects it, which surfaces the "equip a repair tool" prompt).
      const usedToolAction = isHarthmereRepairToolEquipped()
        ? "repair"
        : undefined;
      const job = snapshot?.myAcceptedJobs.find((entry) => entry.jobId === jobId);
      const rewardItems = job?.rewardItems ?? [];
      return run(`complete:${jobId}`, async () => {
        // HARTHMERE_JOB_REWARD_BRIDGE: refuse the turn-in if the reward items
        // would not fit, BEFORE the server marks it complete, so a full backpack
        // never loses the reward. The job stays claimable once space is freed.
        if (
          rewardItems.length > 0 &&
          !harthmereInventoryCanAcceptItems(
            rewardItems.map((reward) => ({
              itemId: reward.itemId,
              quantity: reward.count,
            }))
          )
        ) {
          throw new Error(
            "Free up backpack space to collect this job's reward, then turn it in again."
          );
        }
        const completed = await adapter.completeJobFully(jobId, activeBoardId, {
          todoStatus: todo?.status,
          questTodoId: todo?.todoId,
          usedToolAction,
        });
        // Bridge the payout into the visible HUD wallet + inventory (idempotent
        // per jobId, so a re-fired turn-in can't double-grant).
        grantHarthmereJobReward({
          jobId,
          rewardGold: job?.rewardGold,
          rewardItems,
        });
        return completed;
      });
    },
    [adapter, activeBoardId, run, snapshot],
  );
  const onCancelJob = React.useCallback(
    (jobId: string) =>
      run(`cancel:${jobId}`, () => adapter.cancelJob(jobId, activeBoardId)),
    [adapter, activeBoardId, run],
  );
  const onPostJob = React.useCallback(
    (payload: Record<string, unknown>) =>
      run("post:create", () =>
        adapter.postJob({ ...payload, boardId: activeBoardId })
      ),
    [adapter, activeBoardId, run],
  );

  if (!snapshot) {
    return (
      <div className="harthmere-jobs-board__backdrop" role="dialog" aria-modal="true">
        <section
          className="harthmere-jobs-board"
          data-harthmere-jobs-board-interface="true"
          data-pointer-lock-policy="unlock-while-open"
          data-mouse-policy="show-while-open"
          data-keyboard-navigation="roving-grid-tab-trap-enter"
        >
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
      : pendingActionId
        ? "Sending request to live backend..."
      : loading
        ? "Refreshing from live backend…"
        : `Live · ${snapshot.openJobs.length} open · ${snapshot.myAcceptedJobs.length} accepted by you`;

  // HARTHMERE_JOBS_BOARD_PROXIMITY_GATE:
  // The player must be physically at a board (either via interaction prompt,
  // nearbyBoardId set, or world position inside the board radius). If they
  // aren't, render a "go to the nearest board" notice with wayfinding hints
  // instead of the jobs list. Passing no `worldContext` keeps the legacy
  // behavior (open the panel anyway) so older callers and existing tests
  // are unaffected — only the new HUD wiring passes worldContext.
  if (worldContext) {
    if (!physicalBoardId) {
      const hints = listHarthmereJobsBoardWayfindingHints(snapshot, worldContext);
      return (
        <div
          className="harthmere-jobs-board__backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <section
            className="harthmere-jobs-board"
            data-testid="harthmere-jobs-board-proximity-prompt"
            data-harthmere-jobs-board-interface="true"
            data-pointer-lock-policy="unlock-while-open"
            data-mouse-policy="show-while-open"
            data-keyboard-navigation="roving-grid-tab-trap-enter"
          >
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
  }

  return (
    <div className="harthmere-jobs-board__live-wrapper">
      <HarthmereJobsBoardPanel
        snapshot={snapshot}
        boardId={activeBoardId}
        onAcceptJob={onAcceptJob}
        onCompleteJob={onCompleteJob}
        onCancelJob={onCancelJob}
        onPostJob={onPostJob}
        onClose={onClose}
        pendingActionId={pendingActionId}
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
