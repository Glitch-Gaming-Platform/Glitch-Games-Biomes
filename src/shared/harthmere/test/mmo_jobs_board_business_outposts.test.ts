/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { harthmereOutpostWorkStationForOutpost } from "../jobs_board_field_targets";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessScaledJobPay,
  harthmereBusinessOutpostJobsBoardPosition,
} from "../business_customer_simulator";
import {
  HARTHMERE_JOBS_BOARD_LOCATIONS,
  defaultHarthmereJobsBoardState,
  isActorAtHarthmereJobsBoard,
  reduceHarthmereJobsBoardMutation,
  type HarthmereJobsBoardMutationContext,
  type HarthmereJobsBoardState,
} from "../mmo_jobs_board_authority";

const NOW = 1_800_000_000_000;

function boardIdForOutpost(outpostId: string) {
  return `${outpostId}_jobs_board`;
}

function ctx(
  boardId: string,
  overrides: Partial<HarthmereJobsBoardMutationContext> = {}
): HarthmereJobsBoardMutationContext {
  return {
    actorGold: 1000,
    actorInventoryItems: {},
    nearbyBoardId: boardId,
    ...overrides,
  };
}

function mutate(
  state: HarthmereJobsBoardState,
  boardId: string,
  operation: string,
  payload: Record<string, unknown> = {},
  actorId = "player_a",
  overrides: Partial<HarthmereJobsBoardMutationContext> = {}
) {
  return reduceHarthmereJobsBoardMutation(
    state,
    {
      requestId: `${operation}_${boardId}`,
      actorId,
      nowMs: NOW,
      operation,
      boardId,
      ...payload,
    } as any,
    ctx(boardId, overrides)
  );
}

describe("mmo_jobs_board_authority — business outpost starter jobs", () => {
  it("registers a physical jobs board at every non-Grove business outpost", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const board = state.boards[boardIdForOutpost(outpost.outpostId)];
      assert.ok(board, `${outpost.outpostId} should have a jobs board`);
      assert.equal(board.townId, outpost.townId);
      assert.notEqual(board.townId, "harthmere_grove");
      const boardPosition = harthmereBusinessOutpostJobsBoardPosition(outpost);
      assert.equal(board.location.x, boardPosition.x);
      assert.equal(board.location.z, boardPosition.z);
      assert.equal(board.location.district, outpost.district);
      assert.equal(board.acceptedKinds.length, 1);
      assert.equal(
        HARTHMERE_JOBS_BOARD_LOCATIONS[board.boardId].markerId,
        `${outpost.outpostId}_job_board`
      );
      assert.equal(
        isActorAtHarthmereJobsBoard(
          state,
          { actorPosition: { ...boardPosition, y: outpost.position.y } },
          board.boardId
        ),
        true
      );
    }
  });

  it("auto-seeds an acceptable starter job at the business before the player owns one", () => {
    const outpost = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (entry) => entry.businessType === "food_service_restaurant"
    )!;
    const boardId = boardIdForOutpost(outpost.outpostId);
    const seeded = mutate(
      defaultHarthmereJobsBoardState(NOW),
      boardId,
      "economy_auto_seed_jobs",
      {},
      "economy_seeder"
    );
    assert.deepEqual(seeded.warnings, []);
    const job = Object.values(seeded.jobsBoard.postings)[0];
    assert.equal(job.boardId, boardId);
    assert.equal(job.issuerKind, "npc");
    assert.equal(job.issuerId, outpost.ownerNpcId);
    assert.equal(job.issuerBusinessType, outpost.businessType);
    assert.equal(job.title, `${outpost.job.title} at ${outpost.displayName}`);
    // HARTHMERE_OUTPOST_STARTER_WORK_STATION: the starter job must NOT target
    // the board that issued it, or "sort the stock" is satisfied by reopening
    // the board. It targets the physical work station on the shop apron.
    const workStation = harthmereOutpostWorkStationForOutpost(
      outpost.outpostId
    )!;
    assert.ok(workStation, "every outpost has a starter work station");
    assert.equal(job.targetId, workStation.targetId);
    assert.notEqual(job.targetId, outpost.outpostId);
    assert.equal(job.mapMarkerId, workStation.mapMarkerId);
    assert.notEqual(job.mapMarkerId, `${outpost.outpostId}_job_board`);
    assert.equal(
      job.rewardGold,
      harthmereBusinessScaledJobPay(outpost.job.rewardGold)
    );
    assert.equal(job.autoPosted, true);

    const accepted = mutate(
      seeded.jobsBoard,
      boardId,
      "accept_job",
      { jobId: job.jobId },
      "job_seeker"
    );
    assert.deepEqual(accepted.warnings, []);
    assert.equal(accepted.jobsBoard.postings[job.jobId].status, "active");
    const todo = Object.values(accepted.jobsBoard.todos)[0];
    assert.equal(todo.actorId, "job_seeker");
    assert.equal(todo.targetId, workStation.targetId);
    assert.equal(todo.mapMarkerId, workStation.mapMarkerId);
  });

  it("completes every starter job only through its physical work station and board turn-in", () => {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const boardId = boardIdForOutpost(outpost.outpostId);
      const seeded = mutate(
        defaultHarthmereJobsBoardState(NOW),
        boardId,
        "economy_auto_seed_jobs",
        {},
        `seeder_${outpost.outpostId}`
      );
      assert.deepEqual(seeded.warnings, [], `${outpost.outpostId}:seed`);
      const job = Object.values(seeded.jobsBoard.postings)[0];
      const workStation = harthmereOutpostWorkStationForOutpost(
        outpost.outpostId
      );
      assert.ok(workStation, `${outpost.outpostId}:work-station`);

      const accepted = mutate(
        seeded.jobsBoard,
        boardId,
        "accept_job",
        { jobId: job.jobId },
        "job_seeker"
      );
      assert.deepEqual(accepted.warnings, [], `${outpost.outpostId}:accept`);

      const objective = mutate(
        accepted.jobsBoard,
        boardId,
        "complete_job_quest",
        { jobId: job.jobId, completedTargetId: workStation!.targetId },
        "job_seeker",
        {
          actorPosition: {
            x: workStation!.position[0],
            y: workStation!.position[1],
            z: workStation!.position[2],
          },
          authoritativeCompletedTargetIds: [workStation!.targetId],
          authoritativeServiceProgressCounts: {
            [workStation!.targetId]: 1,
          },
        }
      );
      assert.deepEqual(
        objective.warnings,
        [],
        `${outpost.outpostId}:objective`
      );
      assert.equal(
        Object.values(objective.jobsBoard.todos)[0].status,
        "completed"
      );

      const completed = mutate(
        objective.jobsBoard,
        boardId,
        "complete_job",
        { jobId: job.jobId },
        "job_seeker"
      );
      assert.deepEqual(completed.warnings, [], `${outpost.outpostId}:turn-in`);
      assert.equal(completed.jobsBoard.postings[job.jobId].status, "completed");
      assert.equal(completed.inventoryGoldDelta, job.rewardGold);
    }
  });
});
