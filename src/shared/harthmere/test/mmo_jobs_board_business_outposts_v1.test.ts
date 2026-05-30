/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
} from "../business_customer_simulator_v1";
import {
  HARTHMERE_JOBS_BOARD_LOCATIONS_V1,
  defaultHarthmereJobsBoardStateV1,
  isActorAtHarthmereJobsBoardV1,
  reduceHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardMutationContextV1,
  type HarthmereJobsBoardStateV1,
} from "../mmo_jobs_board_authority_v1";

const NOW = 1_800_000_000_000;

function boardIdForOutpost(outpostId: string) {
  return `${outpostId}_jobs_board`;
}

function ctx(boardId: string, overrides: Partial<HarthmereJobsBoardMutationContextV1> = {}): HarthmereJobsBoardMutationContextV1 {
  return {
    actorGold: 1000,
    actorInventoryItems: {},
    nearbyBoardId: boardId,
    ...overrides,
  };
}

function mutate(
  state: HarthmereJobsBoardStateV1,
  boardId: string,
  operation: string,
  payload: Record<string, unknown> = {},
  actorId = "player_a",
) {
  return reduceHarthmereJobsBoardMutationV1(
    state,
    {
      requestId: `${operation}_${boardId}`,
      actorId,
      nowMs: NOW,
      operation,
      boardId,
      ...payload,
    } as any,
    ctx(boardId),
  );
}

describe("mmo_jobs_board_authority_v1 — business outpost starter jobs", () => {
  it("registers a physical jobs board at every non-Grove business outpost", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      const board = state.boards[boardIdForOutpost(outpost.outpostId)];
      assert.ok(board, `${outpost.outpostId} should have a jobs board`);
      assert.equal(board.townId, outpost.townId);
      assert.notEqual(board.townId, "harthmere_grove");
      const boardPosition = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
      assert.equal(board.location.x, boardPosition.x);
      assert.equal(board.location.z, boardPosition.z);
      assert.equal(board.location.district, outpost.district);
      assert.equal(board.acceptedKinds.length, 1);
      assert.equal(HARTHMERE_JOBS_BOARD_LOCATIONS_V1[board.boardId].markerId, `${outpost.outpostId}_job_board`);
      assert.equal(isActorAtHarthmereJobsBoardV1(state, { actorPosition: { ...boardPosition, y: outpost.position.y } }, board.boardId), true);
    }
  });

  it("auto-seeds an acceptable starter job at the business before the player owns one", () => {
    const outpost = HARTHMERE_BUSINESS_OUTPOSTS_V1.find((entry) => entry.businessType === "food_service_restaurant")!;
    const boardId = boardIdForOutpost(outpost.outpostId);
    const seeded = mutate(defaultHarthmereJobsBoardStateV1(NOW), boardId, "economy_auto_seed_jobs", {}, "economy_seeder");
    assert.deepEqual(seeded.warnings, []);
    const job = Object.values(seeded.jobsBoard.postings)[0];
    assert.equal(job.boardId, boardId);
    assert.equal(job.issuerKind, "npc");
    assert.equal(job.issuerId, outpost.ownerNpcId);
    assert.equal(job.issuerBusinessType, outpost.businessType);
    assert.equal(job.title, `${outpost.job.title} at ${outpost.displayName}`);
    assert.equal(job.targetId, outpost.outpostId);
    assert.equal(job.rewardGold, outpost.job.rewardGold);
    assert.equal(job.autoPosted, true);

    const accepted = mutate(seeded.jobsBoard, boardId, "accept_job", { jobId: job.jobId }, "job_seeker");
    assert.deepEqual(accepted.warnings, []);
    assert.equal(accepted.jobsBoard.postings[job.jobId].status, "active");
    const todo = Object.values(accepted.jobsBoard.todos)[0];
    assert.equal(todo.actorId, "job_seeker");
    assert.equal(todo.targetId, outpost.outpostId);
    assert.equal(todo.mapMarkerId, `${outpost.outpostId}_job_board`);
  });
});
