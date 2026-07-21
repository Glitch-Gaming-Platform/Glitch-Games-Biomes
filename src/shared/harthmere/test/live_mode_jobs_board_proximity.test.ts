/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
} from "../mmo_jobs_board_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_jobs_board_proximity";
let seq = 0;

function freshState(nowMs = NOW_MS): HarthmereLiveModeBackendState {
  return defaultHarthmereLiveModeBackendState(ACTOR, nowMs);
}

function makeEnvelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
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
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  return applyAction(state, "request_jobs_board_mutation", payload, overrides);
}

function applyAction(
  state: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    makeEnvelope(actionKind, payload, overrides),
    NOW_MS
  );
}

function addOpenJob(state: HarthmereLiveModeBackendState) {
  state.jobsBoard.postings.job_client_accept = {
    jobId: "job_client_accept",
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    issuerKind: "town",
    issuerId: "harthmere_grove",
    title: "Client accept regression",
    description: "A focused job for the live accept path.",
    kind: "repair",
    requirements: [
      {
        serviceKind: "repair",
        serviceUnits: 1,
        targetId: "fence_1",
        mapMarkerId: "fence_marker",
      },
    ],
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

describe("live-mode jobs board accept/proximity current", () => {
  it("rejects client-supplied board target ids without server position proof", () => {
    const { summary } = applyOne(
      freshState(),
      {
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        interactionTargetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      },
      { targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID }
    );
    assert.ok(
      summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
  });

  it("accepts jobs from a normal client request when the server attaches the actor position", () => {
    const state = freshState();
    addOpenJob(state);
    const { state: next, summary } = applyOne(
      state,
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_client_accept",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.ok(
      !summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
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
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        title: "Too far",
        description: "This should require walking up to the board.",
        requirements: [{ itemId: "iron_ore", count: 1 }],
        rewardGold: 25,
        deadlineAtMs: NOW_MS + 86_400_000,
      },
      {
        serverActorPosition: {
          x: 501.99486179104775 + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS + 0.1,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.ok(
      summary.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
  });

  it("requires a completed jobs-board quest before live-mode turn-in can pay rewards", () => {
    const state = freshState();
    state.inventory.items = {};
    state.jobsBoard.postings.job_item_turn_in = {
      jobId: "job_item_turn_in",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Patch the fixture",
      description: "Bring repair parts to the marked fixture.",
      kind: "repair",
      requirements: [
        {
          itemId: "repair_part",
          count: 2,
          targetId: "fixture_1",
          mapMarkerId: "fixture_marker",
        },
      ],
      rewardGold: 45,
      escrowGold: 45,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs: NOW_MS + 86_400_000,
      failurePenaltyGold: 0,
      requiresFieldWork: false,
      mapMarkerId: "fixture_marker",
      targetId: "fixture_1",
      abuseFlags: [],
      logs: [],
    };

    const accepted = applyOne(
      state,
      {
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    const todo = Object.values(accepted.state.jobsBoard.todos).find(
      (entry) => entry.jobId === "job_item_turn_in"
    );
    assert.ok(todo, "accepting the job should create a quest todo");

    const earlyTurnIn = applyOne(
      accepted.state,
      {
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.ok(
      earlyTurnIn.summary.warnings.includes(
        "jobs_board_rejected:quest_not_completed"
      )
    );
    assert.equal(earlyTurnIn.state.inventory.gold, state.inventory.gold);

    const missingProof = applyAction(
      accepted.state,
      "request_quest_state_update",
      {
        questId: `jobs_board:${todo!.todoId}`,
        completed: true,
        completedTargetId: "fixture_1",
      },
      { subsystem: "quest" }
    );
    assert.ok(
      missingProof.summary.warnings.some((warning) =>
        warning.includes("missing_completion_item:repair_part")
      )
    );
    assert.equal(
      missingProof.state.jobsBoard.todos[todo!.todoId].status,
      "active"
    );

    const questDone = applyAction(
      accepted.state,
      "request_quest_state_update",
      {
        questId: `jobs_board:${todo!.todoId}`,
        completed: true,
        completedTargetId: "fixture_1",
        completionItemDeltas: { repair_part: -2 },
      },
      {
        subsystem: "quest",
        // Native ECS inventory is authoritative in production. The reducer
        // validates the server-observed stack count and emits an atomic ECS
        // exchange instead of mutating the legacy Redis inventory mirror.
        serverActorItemCounts: { repair_part: 2 },
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.equal(questDone.state.inventory.items.repair_part ?? 0, 0);
    const exchange = questDone.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.ok(
      exchange,
      "quest completion should materialize a native exchange"
    );
    assert.deepEqual(exchange.consumeItemStacks, { repair_part: 2 });
    assert.deepEqual(exchange.rewardItemStacks, {});
    assert.equal(
      questDone.state.jobsBoard.todos[todo!.todoId].status,
      "completed"
    );
    assert.ok(questDone.state.quests.completed[`jobs_board:${todo!.todoId}`]);

    const paid = applyOne(
      questDone.state,
      {
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: "job_item_turn_in",
      },
      {
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        serverActorPosition: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
        },
      }
    );
    assert.equal(
      paid.state.jobsBoard.postings.job_item_turn_in.status,
      "completed"
    );
    assert.equal(paid.state.inventory.gold, state.inventory.gold + 45);
  });
});
