/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
} from "../mmo_jobs_board_authority_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_jobs_board_proximity_v145";
let seq = 0;

function freshState(nowMs = NOW_MS): HarthmereLiveModeBackendStateV1 {
  return defaultHarthmereLiveModeBackendStateV1(ACTOR, nowMs);
}

function makeEnvelope(
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {},
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `jobs-board-proximity-${seq}`,
    idempotencyKey: `jobs-board-proximity-idem-${seq}`,
    actorId: ACTOR,
    actionKind,
    subsystem: "jobs",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

function applyOne(
  state: HarthmereLiveModeBackendStateV1,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {},
) {
  return applyAction(state, "request_jobs_board_mutation", payload, overrides);
}

function applyAction(
  state: HarthmereLiveModeBackendStateV1,
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {},
) {
  return reduceHarthmereLiveModeBackendStateV1(
    state,
    makeEnvelope(actionKind, payload, overrides),
    NOW_MS,
  );
}

function addOpenJob(state: HarthmereLiveModeBackendStateV1) {
  state.jobsBoard.postings.job_client_accept = {
    jobId: "job_client_accept",
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    issuerKind: "town",
    issuerId: "harthmere_grove",
    title: "Client accept regression",
    description: "A focused job for the live accept path.",
    kind: "repair",
    requirements: [{ serviceKind: "repair", serviceUnits: 1, targetId: "fence_1", mapMarkerId: "fence_marker" }],
    rewardGold: 45,
    escrowGold: 45,
    reputationDelta: 1,
    status: "open",
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    createdAtMs: NOW_MS,
    deadlineAtMs: NOW_MS + 86_400_000,
    failurePenaltyGold: 0,
    requiresFieldWork: true,
    mapMarkerId: "fence_marker",
    targetId: "fence_1",
    abuseFlags: [],
    logs: [],
  };
}

describe("live-mode jobs board accept/proximity V145", () => {
  it("rejects client-supplied board target ids without server position proof", () => {
    const { summary } = applyOne(
      freshState(),
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        interactionTargetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
      { targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 },
    );
    assert.ok(summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
  });

  it("accepts jobs from a normal client request when the server attaches the actor position", () => {
    const state = freshState();
    addOpenJob(state);
    const { state: next, summary } = applyOne(
      state,
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_client_accept",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      },
    );
    assert.ok(!summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
    assert.equal(next.jobsBoard.postings.job_client_accept.status, "active");
    assert.equal(Object.values(next.jobsBoard.todos)[0]?.actorId, ACTOR);
  });

  it("rejects jobs board interactions from across the fountain/outside the tight kiosk range", () => {
    const state = freshState();
    state.inventory.gold = 1_000;
    const { summary } = applyOne(
      state,
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        title: "Too far",
        description: "This should require walking up to the board.",
        requirements: [{ itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      {
        serverActorPosition: {
          x: 501.99486179104775 + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 + 0.1,
          y: 70,
          z: -132.00350672753194,
        },
      },
    );
    assert.ok(summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
  });

  it("requires a completed jobs-board quest before live-mode turn-in can pay rewards", () => {
    const state = freshState();
    state.inventory.items = {};
    state.jobsBoard.postings.job_item_turn_in = {
      jobId: "job_item_turn_in",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Patch the fixture",
      description: "Bring repair parts to the marked fixture.",
      kind: "repair",
      requirements: [{ itemId: "repair_part", count: 2, targetId: "fixture_1", mapMarkerId: "fixture_marker" }],
      rewardGold: 45,
      escrowGold: 45,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 0,
      requiresFieldWork: true,
      mapMarkerId: "fixture_marker",
      targetId: "fixture_1",
      abuseFlags: [],
      logs: [],
    };

    const accepted = applyOne(
      state,
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      },
    );
    const todo = Object.values(accepted.state.jobsBoard.todos).find((entry) => entry.jobId === "job_item_turn_in");
    assert.ok(todo, "accepting the job should create a quest todo");

    const earlyTurnIn = applyOne(
      accepted.state,
      {
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      },
    );
    assert.ok(earlyTurnIn.summary.warnings.includes("jobs_board_rejected:quest_not_completed"));
    assert.equal(earlyTurnIn.state.inventory.gold, state.inventory.gold);

    const missingProof = applyAction(
      accepted.state,
      "request_quest_state_update",
      {
        questId: `jobs_board:${todo!.todoId}`,
        completed: true,
        completedTargetId: "fixture_1",
      },
      { subsystem: "quest" },
    );
    assert.ok(missingProof.summary.warnings.some((warning) => warning.includes("missing_completion_item:repair_part")));
    assert.equal(missingProof.state.jobsBoard.todos[todo!.todoId].status, "active");

    accepted.state.inventory.items.repair_part = 2;
    const questDone = applyAction(
      accepted.state,
      "request_quest_state_update",
      {
        questId: `jobs_board:${todo!.todoId}`,
        completed: true,
        completedTargetId: "fixture_1",
        completionItemDeltas: { repair_part: -2 },
      },
      { subsystem: "quest" },
    );
    assert.equal(questDone.state.inventory.items.repair_part ?? 0, 0);
    assert.equal(questDone.state.jobsBoard.todos[todo!.todoId].status, "completed");
    assert.ok(questDone.state.quests.completed[`jobs_board:${todo!.todoId}`]);

    const paid = applyOne(
      questDone.state,
      {
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        serverActorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      },
    );
    assert.equal(paid.state.jobsBoard.postings.job_item_turn_in.status, "completed");
    assert.equal(paid.state.inventory.gold, state.inventory.gold + 45);
  });
});
