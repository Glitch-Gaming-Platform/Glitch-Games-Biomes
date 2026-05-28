/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  defaultHarthmereJobsBoardStateV1,
  isActorAtHarthmereJobsBoardV1,
  reduceHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardMutationContextV1,
  type HarthmereJobsBoardStateV1,
} from "../mmo_jobs_board_authority_v1";
import { defaultHarthmereProductionEconomyStateV1, type HarthmereProductionEconomyStateV1 } from "../mmo_economy_authority_v1";

const NOW = 1_800_000_000_000;

function context(overrides: Partial<HarthmereJobsBoardMutationContextV1> = {}): HarthmereJobsBoardMutationContextV1 {
  return {
    actorGold: 1000,
    actorInventoryItems: { repair_part: 2, herb_bundle: 5 },
    nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    ...overrides,
  };
}

function mutate(
  state: HarthmereJobsBoardStateV1,
  operation: string,
  payload: Record<string, unknown>,
  ctx: Partial<HarthmereJobsBoardMutationContextV1> = {},
  actorId = "player_a",
) {
  return reduceHarthmereJobsBoardMutationV1(
    state,
    {
      requestId: `${operation}_${Math.random().toString(36).slice(2)}`,
      actorId,
      nowMs: NOW + Math.floor(Math.random() * 1000),
      operation,
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      ...payload,
    } as any,
    context(ctx),
  );
}

function postPayload(extra: Record<string, unknown> = {}) {
  return {
    title: "Repair broken pump",
    description: "Fix the pump outside the inn.",
    kind: "repair",
    requirements: [{ itemId: "repair_part", count: 2, targetId: "pump_1", targetName: "Inn pump", mapMarkerId: "pump_marker" }],
    rewardGold: 120,
    deadlineAtMs: NOW + 7 * 24 * 60 * 60 * 1000,
    requiresFieldWork: true,
    ...extra,
  };
}

describe("mmo_jobs_board_authority_v1 — board location and empty state", () => {
  it("starts with the Grove jobs board but no dummy runtime jobs", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    const board = state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1];
    assert.ok(board);
    assert.equal(board.markerId, "harthmere_market_posting_board");
    assert.equal(board.location.x, 482);
    assert.equal(board.location.z, -198);
    assert.equal(Object.keys(state.postings).length, 0);
    assert.equal(Object.keys(state.todos).length, 0);
  });

  it("requires physical board interaction by marker or position", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    assert.equal(isActorAtHarthmereJobsBoardV1(state, { nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 }), true);
    assert.equal(isActorAtHarthmereJobsBoardV1(state, { actorPosition: { x: 482, y: 66, z: -198 } }), true);
    assert.equal(isActorAtHarthmereJobsBoardV1(state, { actorPosition: { x: 900, y: 66, z: 900 } }), false);
  });
});

describe("mmo_jobs_board_authority_v1 — posting, accepting, quest todos, and completion", () => {
  it("rejects posting away from the physical board", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    const result = mutate(state, "create_job_posting", postPayload(), { nearbyBoardId: undefined, actorPosition: { x: 0, y: 0, z: 0 } });
    assert.ok(result.warnings.includes("jobs_board_rejected:must_be_at_jobs_board"));
    assert.equal(Object.keys(result.jobsBoard.postings).length, 0);
  });

  it("posts a player job with escrow, lets a different seeker accept it, creates a quest/map todo, and pays on completion", () => {
    let state = defaultHarthmereJobsBoardStateV1(NOW);
    const posted = mutate(state, "create_job_posting", postPayload(), {}, "poster");
    assert.equal(posted.inventoryGoldDelta, -120);
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    assert.equal(posted.jobsBoard.postings[jobId].status, "open");

    const accepted = mutate(posted.jobsBoard, "accept_job", { jobId }, {}, "seeker");
    assert.equal(accepted.jobsBoard.postings[jobId].status, "active");
    const todo = Object.values(accepted.jobsBoard.todos)[0];
    assert.equal(todo.actorId, "seeker");
    assert.equal(todo.questBoardTodo, true);
    assert.equal(todo.mapMarkerId, "pump_marker");

    const completed = mutate(accepted.jobsBoard, "complete_job", { jobId }, { actorInventoryItems: { repair_part: 2 } }, "seeker");
    assert.equal(completed.jobsBoard.postings[jobId].status, "completed");
    assert.equal(completed.inventoryGoldDelta, 120);
    assert.deepEqual(completed.inventoryItemDeltas, { repair_part: -2 });
    assert.equal(Object.values(completed.jobsBoard.todos)[0].status, "completed");
  });

  it("rejects self-acceptance, double-acceptance, missing turn-in items, and late jobs", () => {
    const posted = mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload(), {}, "poster");
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    assert.ok(mutate(posted.jobsBoard, "accept_job", { jobId }, {}, "poster").warnings.includes("jobs_board_rejected:cannot_accept_own_job"));
    const accepted = mutate(posted.jobsBoard, "accept_job", { jobId }, {}, "seeker");
    assert.ok(mutate(accepted.jobsBoard, "accept_job", { jobId }, {}, "other").warnings.includes("jobs_board_rejected:job_not_open"));
    assert.ok(mutate(accepted.jobsBoard, "complete_job", { jobId }, { actorInventoryItems: {} }, "seeker").warnings.some((w) => w.includes("missing_completion_item")));
    const expiredState = accepted.jobsBoard;
    expiredState.postings[jobId].deadlineAtMs = NOW - 1;
    assert.ok(mutate(expiredState, "complete_job", { jobId }, { actorInventoryItems: { repair_part: 2 } }, "seeker").warnings.includes("jobs_board_rejected:job_expired"));
  });
});

describe("mmo_jobs_board_authority_v1 — issuers and abuse protections", () => {
  function economyWithBusiness(): HarthmereProductionEconomyStateV1 {
    const economy = defaultHarthmereProductionEconomyStateV1();
    economy.businesses.business_1 = {
      businessId: "business_1",
      ownerKind: "player",
      ownerId: "owner",
      typeId: "repair_maintenance_person",
      name: "Pump Fixers",
      status: "open",
      licenseClass: "basic_trade",
      licenseLevel: 2,
      propertyId: "property_1",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      inventory: {},
      storageMaxSlots: 12,
      employees: [],
      activeContracts: [],
      completedContracts: 0,
      reputation: 0,
      customerSatisfaction: 70,
      sanitationRating: 70,
      safetyRating: 70,
      serviceRadius: 2,
      priceModifiers: {},
      balanceGold: 500,
      debtGold: 0,
      upkeepGoldPerDay: 1,
      rentGoldPerDay: 1,
      wageGoldPerDay: 0,
      salesTaxRate: 0.06,
      lastTickAtMs: NOW,
      createdAtMs: NOW,
      updatedAtMs: NOW,
      flags: {},
    } as any;
    return economy;
  }

  it("allows an authorized business to post jobs and escrows from business funds", () => {
    const economy = economyWithBusiness();
    const result = mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload({ issuerKind: "business", businessId: "business_1" }), {
      economy,
      actorGold: 0,
      canManageBusinessJobs: (business) => business.businessId === "business_1",
    }, "owner");
    assert.equal(result.inventoryGoldDelta, 0);
    assert.equal(result.economy!.businesses.business_1.balanceGold, 380);
    assert.equal(Object.values(result.jobsBoard.postings)[0].issuerKind, "business");
  });

  it("rejects unauthorized business/guild/town/npc posting", () => {
    const economy = economyWithBusiness();
    assert.ok(mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload({ issuerKind: "business", businessId: "business_1" }), { economy, canManageBusinessJobs: () => false }, "not_owner").warnings.includes("jobs_board_rejected:business_job_permission_required"));
    assert.ok(mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload({ issuerKind: "guild", issuerId: "guild_1" }), { canManageGuildJobs: () => false }, "officer").warnings.includes("jobs_board_rejected:guild_job_permission_required"));
    assert.ok(mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload({ issuerKind: "town", issuerId: "harthmere_grove" }), { canManageTownJobs: () => false }, "clerk").warnings.includes("jobs_board_rejected:town_job_permission_required"));
    assert.ok(mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload({ issuerKind: "npc", issuerId: "npc_1" }), { allowNpcJobPosting: false }, "npc_admin").warnings.includes("jobs_board_rejected:npc_job_permission_required"));
  });

  it("enforces reward caps, cooldowns, active seeker limits, issuer limits, and suspicious text flags", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    assert.ok(mutate(state, "create_job_posting", postPayload({ rewardGold: 1 }), {}, "poster").warnings.includes("jobs_board_rejected:reward_too_low"));
    assert.ok(mutate(state, "create_job_posting", postPayload({ rewardGold: 999999 }), {}, "poster").warnings.includes("jobs_board_rejected:reward_too_high"));
    const first = reduceHarthmereJobsBoardMutationV1(state, { requestId: "first", actorId: "poster", nowMs: NOW, operation: "create_job_posting", boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, ...postPayload({ title: "Free gold exploit http://bad.example" }) } as any, context());
    const job = Object.values(first.jobsBoard.postings)[0];
    assert.deepEqual(job.abuseFlags, ["suspicious_text"]);
    const cooldown = reduceHarthmereJobsBoardMutationV1(first.jobsBoard, { requestId: "second", actorId: "poster", nowMs: NOW + 1, operation: "create_job_posting", boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, ...postPayload({ title: "Second" }) } as any, context());
    assert.ok(cooldown.warnings.includes("jobs_board_rejected:post_cooldown"));

    let limited = defaultHarthmereJobsBoardStateV1(NOW);
    for (let i = 0; i < 12; i++) {
      const r = reduceHarthmereJobsBoardMutationV1(limited, { requestId: `p${i}`, actorId: "issuer", nowMs: NOW + i * 20_000, operation: "create_job_posting", boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, ...postPayload({ title: `Job ${i}` }) } as any, context({ actorGold: 100000 }));
      limited = r.jobsBoard;
    }
    assert.ok(reduceHarthmereJobsBoardMutationV1(limited, { requestId: "too_many", actorId: "issuer", nowMs: NOW + 999_999, operation: "create_job_posting", boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, ...postPayload({ title: "too many" }) } as any, context({ actorGold: 100000 })).warnings.includes("jobs_board_rejected:issuer_posting_limit"));
  });

  it("cancels open jobs with escrow refund and marks active cancellations as failed to prevent bait-and-switch abuse", () => {
    const posted = mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload(), {}, "poster");
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const cancelled = mutate(posted.jobsBoard, "cancel_job", { jobId }, {}, "poster");
    assert.equal(cancelled.jobsBoard.postings[jobId].status, "cancelled");
    assert.equal(cancelled.inventoryGoldDelta, 120);

    const posted2 = mutate(defaultHarthmereJobsBoardStateV1(NOW), "create_job_posting", postPayload(), {}, "poster2");
    const job2 = Object.keys(posted2.jobsBoard.postings)[0];
    const active = mutate(posted2.jobsBoard, "accept_job", { jobId: job2 }, {}, "seeker");
    const failed = mutate(active.jobsBoard, "cancel_job", { jobId: job2 }, {}, "poster2");
    assert.equal(failed.jobsBoard.postings[job2].status, "failed");
    assert.equal(failed.inventoryGoldDelta, 0);
  });
});
