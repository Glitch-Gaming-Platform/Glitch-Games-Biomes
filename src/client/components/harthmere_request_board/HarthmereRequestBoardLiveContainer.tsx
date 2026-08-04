import * as React from "react";

import {
  progressQuestAtEntity,
  useRelevantStepsForEntity,
  type QuestStepBundle,
} from "@/client/components/challenges/helpers";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import { installHarthmereJobsBoardStyles } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardStyles";
import type {
  HarthmereJobsBoardPosting,
  HarthmereJobsBoardSnapshot,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { nativeRequestBoardSnapshot } from "@/client/components/biomes_ui/adapters/nativeRequestBoardAdapter";
import type { QuestBundle } from "@/client/game/resources/challenges";
import { anItem } from "@/shared/game/item";
import { inventoryCount } from "@/shared/game/inventory";
import {
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
  harthmereBoardRequestByQuestId,
  harthmereRequestBoardByEntityId,
  type HarthmereRequestBoard,
} from "@/shared/harthmere/native_request_boards";
import { safeParseBiomesId, type BiomesId } from "@/shared/ids";

export const HARTHMERE_REQUEST_BOARD_PANEL_VERSION =
  "harthmere-request-board-native-panel-v1" as const;

function requestBoardForEntity(entityId: BiomesId) {
  if (Number(entityId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)) {
    return HARTHMERE_REQUEST_BOARDS.find(
      (board) => board.category === "fishing"
    );
  }
  return harthmereRequestBoardByEntityId(entityId);
}

function questIdFromPosting(jobId: string) {
  return safeParseBiomesId(jobId.replace(/^native_request:/, ""));
}

function itemDisplayName(itemId: string) {
  const id = safeParseBiomesId(itemId);
  if (!id) return itemId;
  try {
    return anItem(id).displayName ?? itemId;
  } catch {
    return itemId;
  }
}

function requestRewardLabel(job: HarthmereJobsBoardPosting) {
  if (job.rewardGold > 0) {
    return `${job.rewardGold} Bling`;
  }
  const rewards = job.rewardItems ?? [];
  return rewards.length > 0
    ? rewards
        .map((reward) => `${reward.count} ${itemDisplayName(reward.itemId)}`)
        .join(" + ")
    : "Authored board reward";
}

function requestRequirementLabel(job: HarthmereJobsBoardPosting) {
  return job.requirements
    .map((requirement) => {
      if (requirement.itemId) {
        return `${requirement.count ?? 1} × ${itemDisplayName(
          requirement.itemId
        )}`;
      }
      return requirement.targetName ?? requirement.targetId ?? job.kind;
    })
    .join(" · ");
}

function HarthmereRequestBoardPanel({
  board,
  snapshot,
  introStep,
  readyJobIds,
  pendingActionId,
  error,
  onAdvance,
  onClose,
}: {
  board: HarthmereRequestBoard;
  snapshot: HarthmereJobsBoardSnapshot;
  introStep?: QuestStepBundle;
  readyJobIds: ReadonlySet<string>;
  pendingActionId?: string;
  error?: string;
  onAdvance: (jobId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<"available" | "active">("available");
  const record = snapshot.boards[snapshot.defaultBoardId];
  const available = snapshot.openJobs.filter(
    (job) => job.boardId === snapshot.defaultBoardId
  );
  const active = snapshot.activeJobs.filter(
    (job) => job.boardId === snapshot.defaultBoardId
  );

  React.useEffect(() => {
    installBiomesUITheme();
    installHarthmereJobsBoardStyles();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const jobs = tab === "available" ? available : active;
  return (
    <div
      className="harthmere-jobs-board__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={record.displayName}
      data-testid="harthmere-request-board-panel"
      data-request-board-category={board.category}
      data-request-board-version={HARTHMERE_REQUEST_BOARD_PANEL_VERSION}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="harthmere-jobs-board" role="document">
        <header className="harthmere-jobs-board__header">
          <div>
            <h2>{record.displayName}</h2>
            <p>
              {record.location.district} · {board.blurb}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close board">
            ×
          </button>
        </header>
        <nav
          className="harthmere-jobs-board__tabs"
          role="tablist"
          aria-label={`${record.displayName} sections`}
        >
          <button
            type="button"
            role="tab"
            className={tab === "available" ? "active" : ""}
            aria-selected={tab === "available"}
            onClick={() => setTab("available")}
          >
            Requests ({available.length})
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "active" ? "active" : ""}
            aria-selected={tab === "active"}
            onClick={() => setTab("active")}
          >
            Accepted ({active.length})
          </button>
        </nav>
        <main className="harthmere-jobs-board__content">
          {error && (
            <div className="harthmere-jobs-board__status" data-state="error">
              {error}
            </div>
          )}
          {introStep && available.length === 0 && active.length === 0 && (
            <div className="harthmere-jobs-grid">
              <article className="harthmere-jobs-card harthmere-jobs-card--wide">
                <strong>{introStep.questBundle.biscuit.displayName}</strong>
                <span>{introStep.dialogText || board.blurb}</span>
                <small>
                  Read the board introduction to unlock its standing requests.
                </small>
                <button
                  type="button"
                  disabled={Boolean(pendingActionId)}
                  data-harthmere-request-board-intro="true"
                  onClick={() =>
                    void onAdvance(
                      `native_request:${introStep.questBundle.biscuit.id}`
                    )
                  }
                >
                  {pendingActionId
                    ? "Opening…"
                    : (introStep.acceptText ?? "Read Board")}
                </button>
              </article>
            </div>
          )}
          {!introStep && jobs.length === 0 && (
            <p className="empty">
              {tab === "available"
                ? "No requests are currently posted on this board."
                : "You have no accepted requests from this board."}
            </p>
          )}
          {jobs.length > 0 && (
            <div className="harthmere-jobs-grid">
              {jobs.map((job) => {
                const pending = pendingActionId === job.jobId;
                const ready = readyJobIds.has(job.jobId);
                return (
                  <article className="harthmere-jobs-card" key={job.jobId}>
                    <strong>{job.title}</strong>
                    <span>{job.description}</span>
                    <small>
                      Need: {requestRequirementLabel(job)} · Reward:{" "}
                      {requestRewardLabel(job)}
                    </small>
                    <button
                      type="button"
                      disabled={
                        Boolean(pendingActionId) || (tab === "active" && !ready)
                      }
                      data-harthmere-request-board-action="true"
                      data-request-job-id={job.jobId}
                      data-request-ready={ready ? "true" : "false"}
                      onClick={() => void onAdvance(job.jobId)}
                    >
                      {pending
                        ? tab === "available"
                          ? "Accepting…"
                          : "Turning In…"
                        : tab === "available"
                          ? "Accept Request"
                          : ready
                            ? "Turn In Request"
                            : "Requirements Missing"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

export function HarthmereRequestBoardLiveContainer({
  boardEntityId,
  onClose,
}: {
  boardEntityId: BiomesId;
  onClose: () => void;
}) {
  const { reactResources, resources, events, userId } = useClientContext();
  const board = requestBoardForEntity(boardEntityId);
  const challenges =
    (reactResources.use("/challenges/all") as QuestBundle[] | undefined) ?? [];
  const inventory = reactResources.use("/ecs/c/inventory", userId);
  const relevantSteps = useRelevantStepsForEntity(boardEntityId);
  const [pendingActionId, setPendingActionId] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    resources.update("/scene/local_player", (localPlayer) => {
      localPlayer.talkingToNpc = boardEntityId;
      localPlayer.talkingToNpcCameraDisabled = true;
    });
    return () => {
      resources.update("/scene/local_player", (localPlayer) => {
        if (localPlayer.talkingToNpc === boardEntityId) {
          localPlayer.talkingToNpc = undefined;
          localPlayer.talkingToNpcCameraDisabled = false;
        }
      });
    };
  }, [boardEntityId, resources]);

  const lookup = React.useMemo(() => {
    const completed = new Set<number>();
    const inProgress = new Set<number>();
    for (const quest of challenges) {
      if (quest.state === "completed") completed.add(Number(quest.biscuit.id));
      if (quest.state === "in_progress") {
        inProgress.add(Number(quest.biscuit.id));
      }
    }
    return {
      completed,
      inProgress,
      introComplete: completed,
      heldCount: (itemId: BiomesId) =>
        inventory
          ? Number(
              inventoryCount(inventory, anItem(itemId), {
                respectPayload: false,
              })
            )
          : 0,
    };
  }, [challenges, inventory]);

  const snapshot = React.useMemo(
    () =>
      nativeRequestBoardSnapshot({
        boardEntityId,
        actorId: String(userId),
        lookup,
      }),
    [boardEntityId, lookup, userId]
  );

  const introStep = board
    ? relevantSteps.find(
        (step) =>
          Number(step.questBundle.biscuit.id) === Number(board.introQuestId)
      )
    : undefined;
  const readyJobIds = React.useMemo(() => {
    const ready = new Set<string>();
    for (const job of snapshot?.activeJobs ?? []) {
      const questId = questIdFromPosting(job.jobId);
      const request = questId
        ? harthmereBoardRequestByQuestId(questId)
        : undefined;
      if (request && lookup.heldCount(request.itemId) >= request.count) {
        ready.add(job.jobId);
      }
    }
    return ready;
  }, [lookup, snapshot?.activeJobs]);

  const advance = React.useCallback(
    async (jobId: string) => {
      if (pendingActionId) return;
      const questId = questIdFromPosting(jobId);
      const step = questId
        ? relevantSteps.find(
            (candidate) =>
              Number(candidate.questBundle.biscuit.id) === Number(questId)
          )
        : undefined;
      if (!questId || !step) {
        setError("This request is not ready for its next native quest step.");
        return;
      }
      setError(undefined);
      setPendingActionId(jobId);
      try {
        await progressQuestAtEntity(
          step,
          boardEntityId,
          userId,
          resources,
          events
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setPendingActionId(undefined);
      }
    },
    [boardEntityId, events, pendingActionId, relevantSteps, resources, userId]
  );

  if (!board || !snapshot) {
    return null;
  }
  return (
    <HarthmereRequestBoardPanel
      board={board}
      snapshot={snapshot}
      introStep={introStep}
      readyJobIds={readyJobIds}
      pendingActionId={pendingActionId}
      error={error}
      onAdvance={advance}
      onClose={onClose}
    />
  );
}
