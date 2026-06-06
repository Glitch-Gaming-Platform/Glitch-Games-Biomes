import * as React from "react";
import {
  createHarthmereJobsBoardAdapterV1,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  nearestPhysicalHarthmereJobsBoardIdV141,
  type HarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardWorldContextV1,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { useHarthmereJobsBoard } from "@/client/components/harthmere_jobs_board/useHarthmereJobsBoard";
import {
  grantHarthmereJobRewardV151,
  harthmereInventoryCanAcceptItemsV151,
  isHarthmereRepairToolEquippedV151,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HarthmereWantedBoardPanel } from "./HarthmereWantedBoardPanel";
import {
  buildHarthmereWantedBoardViewV1,
  submitHarthmereWantedBoardClearBountyV1,
} from "./wantedBoardLiveAdapter";
import { installHarthmereWantedBoardStylesV1 } from "./HarthmereWantedBoardStylesV1";

export function HarthmereWantedBoardLiveContainerV1({
  boardId,
  worldContext,
  onClose,
}: {
  boardId?: string;
  worldContext?: HarthmereJobsBoardWorldContextV1;
  onClose?: () => void;
}) {
  const { state, loading, error } = useHarthmereJobsBoard();
  const [snapshot, setSnapshot] = React.useState<
    HarthmereJobsBoardSnapshotV1 | undefined
  >();
  const [mutationError, setMutationError] = React.useState<string | undefined>();
  const [pendingActionId, setPendingActionId] = React.useState<string | undefined>();
  const adapter = React.useMemo(() => createHarthmereJobsBoardAdapterV1(), []);

  React.useEffect(() => {
    installHarthmereWantedBoardStylesV1();
  }, []);

  React.useEffect(() => {
    if (state) setSnapshot(state);
  }, [state]);

  const physicalBoardId = React.useMemo(
    () =>
      worldContext
        ? nearestPhysicalHarthmereJobsBoardIdV141(snapshot, worldContext)
        : undefined,
    [snapshot, worldContext]
  );

  const activeBoardId =
    boardId ??
    physicalBoardId ??
    snapshot?.defaultBoardId ??
    HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;

  const run = React.useCallback(
    async (actionId: string, op: () => Promise<HarthmereJobsBoardSnapshotV1>) => {
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
    [pendingActionId]
  );

  const onAcceptJob = React.useCallback(
    (jobId: string, preferredBoardId?: string) => {
      const job = snapshot?.openJobs.find((entry) => entry.jobId === jobId);
      const mutationBoardId = preferredBoardId ?? job?.boardId ?? activeBoardId;
      return run(`job:${jobId}`, () =>
        adapter.acceptJob(jobId, mutationBoardId)
      );
    },
    [activeBoardId, adapter, run, snapshot]
  );

  const onCompleteJob = React.useCallback(
    (jobId: string, preferredBoardId?: string) => {
      const job = snapshot?.myAcceptedJobs.find((entry) => entry.jobId === jobId);
      const todo = snapshot?.myTodos.find((entry) => entry.jobId === jobId);
      const mutationBoardId = preferredBoardId ?? job?.boardId ?? activeBoardId;
      const rewardItems = job?.rewardItems ?? [];
      const usedToolAction = isHarthmereRepairToolEquippedV151()
        ? "repair"
        : undefined;
      return run(`job:${jobId}`, async () => {
        if (
          rewardItems.length > 0 &&
          !harthmereInventoryCanAcceptItemsV151(
            rewardItems.map((reward) => ({
              itemId: reward.itemId,
              quantity: reward.count,
            }))
          )
        ) {
          throw new Error(
            "Free up backpack space to collect this bounty reward, then turn it in again."
          );
        }
        const completed = await adapter.completeJobFully(jobId, mutationBoardId, {
          todoStatus: todo?.status,
          questTodoId: todo?.todoId,
          usedToolAction,
        });
        grantHarthmereJobRewardV151({
          jobId,
          rewardGold: job?.rewardGold,
          rewardItems,
        });
        return completed;
      });
    },
    [activeBoardId, adapter, run, snapshot]
  );

  const onClearBounty = React.useCallback(
    (factionId?: string) =>
      run(`clear:${factionId ?? "city_guard"}`, async () => {
        await submitHarthmereWantedBoardClearBountyV1({ factionId });
        return adapter.fetchState();
      }),
    [adapter, run]
  );

  if (!snapshot) {
    return (
      <HarthmereWantedBoardPanel
        statusLine={
          error || mutationError || (loading ? "Loading live wanted board..." : "Connecting to live wanted board...")
        }
        statusState={error || mutationError ? "error" : "info"}
        onClose={onClose}
      />
    );
  }

  const view = buildHarthmereWantedBoardViewV1(snapshot, activeBoardId);
  const statusLine = mutationError
    ? mutationError
    : error
    ? error
    : pendingActionId
    ? "Sending request to live backend..."
    : loading
    ? "Refreshing live wanted notices..."
    : `Live · ${view.totals.open} open · ${view.totals.law} warrants · ${view.law.activeBountyGold} bounty gold`;

  return (
    <HarthmereWantedBoardPanel
      snapshot={snapshot}
      boardId={activeBoardId}
      view={view}
      statusLine={statusLine}
      statusState={error || mutationError ? "error" : "info"}
      pendingActionId={pendingActionId}
      onAcceptJob={onAcceptJob}
      onCompleteJob={onCompleteJob}
      onClearBounty={onClearBounty}
      onClose={onClose}
    />
  );
}
