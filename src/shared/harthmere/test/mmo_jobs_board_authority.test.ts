/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  HARTHMERE_ESCORT_ACCEPT_WINDOW_MAX_MS,
  HARTHMERE_ESCORT_ACCEPT_WINDOW_MIN_MS,
  HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MAX_MS,
  HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MIN_MS,
  HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS,
  HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  createHarthmereJobsBoardClientSnapshot,
  defaultHarthmereJobsBoardState,
  formatHarthmereJobTimeRemaining,
  harthmereDeliveryPlan,
  isActorAtHarthmereJobsBoard,
  reduceHarthmereJobsBoardMutation,
  type HarthmereJobsBoardMutationContext,
  type HarthmereJobsBoardState,
} from "../mmo_jobs_board_authority";
import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES,
  defaultHarthmereProductionEconomyState,
  type HarthmereProductionEconomyState,
} from "../mmo_economy_authority";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
  isKnownHarthmereJobsBoardExecutableItemId,
} from "../jobs_board_business_templates";
import {
  harthmereJobsBoardQuestMarkerPositionForId,
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} from "../jobs_board_quest_marker_positions";

const NOW = 1_800_000_000_000;

function context(
  overrides: Partial<HarthmereJobsBoardMutationContext> = {}
): HarthmereJobsBoardMutationContext {
  return {
    actorGold: 1000,
    actorInventoryItems: { repair_part: 2, herb_bundle: 5 },
    nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    ...overrides,
  };
}

function mutate(
  state: HarthmereJobsBoardState,
  operation: string,
  payload: Record<string, unknown>,
  ctx: Partial<HarthmereJobsBoardMutationContext> = {},
  actorId = "player_a"
) {
  const jobId = typeof payload.jobId === "string" ? payload.jobId : undefined;
  const posting = jobId ? state.postings[jobId] : undefined;
  const marker =
    operation === "complete_job_quest" && posting?.requiresFieldWork
      ? harthmereJobsBoardQuestMarkerRuntimePositionForId(
          posting.mapMarkerId ??
            posting.requirements.find((requirement) => requirement.mapMarkerId)
              ?.mapMarkerId ??
            ""
        )
      : undefined;
  const authoritativeCompletedTargetIds =
    operation === "complete_job_quest" && posting
      ? posting.requirements.flatMap((requirement) => [
          ...(requirement.targetId ? [requirement.targetId] : []),
          ...(requirement.recipientNpcId
            ? [
                requirement.recipientNpcId,
                `${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}${requirement.recipientNpcId}`,
              ]
            : []),
        ])
      : undefined;
  return reduceHarthmereJobsBoardMutation(
    state,
    {
      requestId: `${operation}_${Math.random().toString(36).slice(2)}`,
      actorId,
      nowMs: NOW + Math.floor(Math.random() * 1000),
      operation,
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      ...payload,
    } as any,
    context({
      ...(marker
        ? {
            actorPosition: {
              x: marker.position[0],
              y: marker.position[1],
              z: marker.position[2],
            },
          }
        : {}),
      authoritativeCompletedTargetIds,
      ...ctx,
    })
  );
}

function postPayload(extra: Record<string, unknown> = {}) {
  return {
    title: "Repair broken pump",
    description: "Fix the pump outside the inn.",
    kind: "repair",
    requirements: [
      {
        itemId: "repair_part",
        count: 2,
        targetId: "pump_1",
        targetName: "Inn pump",
        mapMarkerId: "old_grove_road_post",
      },
    ],
    rewardGold: 120,
    deadlineAtMs: NOW + 7 * 24 * 60 * 60 * 1000,
    requiresFieldWork: true,
    mapMarkerId: "old_grove_road_post",
    targetId: "pump_1",
    ...extra,
  };
}

function escortPostPayload(extra: Record<string, unknown> = {}) {
  return postPayload({
    title: "Escort a Newcomer to the Road Post",
    description: "Walk a newcomer safely to the road post.",
    kind: "escort",
    requirements: [
      {
        serviceKind: "escort",
        serviceUnits: 1,
        targetId: "old_grove_road_post",
        targetName: "Road Post",
        mapMarkerId: "old_grove_road_post",
      },
    ],
    rewardGold: 91,
    requiresFieldWork: true,
    ...extra,
  });
}

describe("mmo_jobs_board_authority — board location and empty state", () => {
  it("starts with the Grove jobs board but no dummy runtime jobs", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    const board = state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
    assert.ok(board);
    assert.equal(board.markerId, "harthmere_market_posting_board");
    assert.equal(board.displayName, "Jobs Board");
    // HARTHMERE_JOBS_BOARD_GROVE_PLACEMENT: board moved into the Grove
    // (was [482, ?, -198] in Harthmere market square).
    assert.equal(board.location.x, 501.99486179104775);
    assert.equal(board.location.z, -132.00350672753194);
    assert.equal(
      board.location.radius,
      HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS
    );
    assert.equal(Object.keys(state.postings).length, 0);
    assert.equal(Object.keys(state.todos).length, 0);
  });

  it("requires physical board interaction by marker or position", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    assert.equal(
      isActorAtHarthmereJobsBoard(state, {
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }),
      true
    );
    assert.equal(
      isActorAtHarthmereJobsBoard(state, {
        actorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      }),
      true
    );
    assert.equal(
      isActorAtHarthmereJobsBoard(state, {
        actorPosition: {
          x: 501.99486179104775 + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS + 0.1,
          y: 70,
          z: -132.00350672753194,
        },
      }),
      false
    );
    assert.equal(
      isActorAtHarthmereJobsBoard(state, {
        actorPosition: { x: 900, y: 66, z: 900 },
      }),
      false
    );
  });
});

describe("mmo_jobs_board_authority — posting, accepting, quest todos, and completion", () => {
  it("rejects posting away from the physical board", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    const result = mutate(state, "create_job_posting", postPayload(), {
      nearbyBoardId: undefined,
      actorPosition: { x: 0, y: 0, z: 0 },
    });
    assert.ok(
      result.warnings.includes("jobs_board_rejected:must_be_at_jobs_board")
    );
    assert.equal(Object.keys(result.jobsBoard.postings).length, 0);
  });

  it("posts a player job with escrow, lets a different seeker accept it, creates a quest/map todo, and pays on completion", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    const posted = mutate(
      state,
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    assert.equal(posted.inventoryGoldDelta, -120);
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    assert.equal(posted.jobsBoard.postings[jobId].status, "open");

    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    assert.equal(accepted.jobsBoard.postings[jobId].status, "active");
    const todo = Object.values(accepted.jobsBoard.todos)[0];
    assert.equal(todo.actorId, "seeker");
    assert.equal(todo.questBoardTodo, true);
    assert.equal(todo.mapMarkerId, "old_grove_road_post");

    const earlyTurnIn = mutate(
      accepted.jobsBoard,
      "complete_job",
      { jobId },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    assert.ok(
      earlyTurnIn.warnings.includes("jobs_board_rejected:quest_not_completed")
    );
    assert.equal(earlyTurnIn.inventoryGoldDelta, 0);

    const questDone = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    assert.equal(questDone.jobsBoard.postings[jobId].status, "active");
    assert.deepEqual(questDone.inventoryItemDeltas, { repair_part: -2 });
    assert.equal(
      Object.values(questDone.jobsBoard.todos)[0].status,
      "completed"
    );

    const completed = mutate(
      questDone.jobsBoard,
      "complete_job",
      { jobId },
      { actorInventoryItems: {} },
      "seeker"
    );
    assert.equal(completed.jobsBoard.postings[jobId].status, "completed");
    assert.equal(completed.inventoryGoldDelta, 120);
    assert.deepEqual(completed.inventoryItemDeltas, {});
    assert.equal(
      Object.values(completed.jobsBoard.todos)[0].status,
      "completed"
    );
    assert.deepEqual(
      createHarthmereJobsBoardClientSnapshot(completed.jobsBoard, "seeker")
        .myAcceptedJobs,
      [],
      "completed jobs should leave the seeker's active My Jobs list"
    );
  });

  it("accepts completion items from material storage when the backpack is empty", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload()
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );

    const questDone = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      {
        actorInventoryItems: {},
        actorMaterialStorageItems: { repair_part: 2 },
      },
      "seeker"
    );

    assert.deepEqual(questDone.warnings, []);
    assert.deepEqual(questDone.inventoryItemDeltas, { repair_part: -2 });
    assert.equal(
      Object.values(questDone.jobsBoard.todos)[0].status,
      "completed"
    );
  });

  it("rejects self-acceptance, double-acceptance, missing turn-in items, and late jobs", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    assert.ok(
      mutate(
        posted.jobsBoard,
        "accept_job",
        { jobId },
        {},
        "poster"
      ).warnings.includes("jobs_board_rejected:cannot_accept_own_job")
    );
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    assert.ok(
      mutate(
        accepted.jobsBoard,
        "accept_job",
        { jobId },
        {},
        "other"
      ).warnings.includes("jobs_board_rejected:job_not_open")
    );
    assert.ok(
      mutate(
        accepted.jobsBoard,
        "complete_job_quest",
        { jobId },
        { actorInventoryItems: {} },
        "seeker"
      ).warnings.some((w) => w.includes("missing_completion_item"))
    );
    // HARTHMERE_JOB_ACCEPT_TIMER: a lapsed accept-window is now auto-FAILED
    // by the lazy sweep on the next interaction (released to open), so a late
    // completion is rejected (the job is no longer active for this seeker) and
    // the seeker's todo is marked failed.
    const expiredState = accepted.jobsBoard;
    expiredState.postings[jobId].deadlineAtMs = NOW - 1;
    const late = mutate(
      expiredState,
      "complete_job_quest",
      { jobId },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    assert.ok(late.warnings.length > 0, "late completion is rejected");
    const lateTodo = Object.values(late.jobsBoard.todos).find(
      (t) => t.jobId === jobId && t.actorId === "seeker"
    );
    assert.equal(
      lateTodo?.status,
      "failed",
      "the lapsed quest is marked failed"
    );
  });

  it("marks expired open jobs as shared-state changes when accept rejects them", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    posted.jobsBoard.postings[jobId].deadlineAtMs = NOW - 1;

    const rejected = reduceHarthmereJobsBoardMutation(
      posted.jobsBoard,
      {
        requestId: "accept_expired_shared_state",
        actorId: "seeker",
        nowMs: NOW + 1_000,
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId,
      } as any,
      context()
    );

    assert.ok(rejected.warnings.includes("jobs_board_rejected:job_expired"));
    assert.equal(rejected.jobsBoard.postings[jobId].status, "expired");
    assert.ok(
      rejected.sharedStateKeys.includes(
        `harthmere:jobs_board:${HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID}`
      )
    );
    assert.ok(
      rejected.sharedStateKeys.includes(`harthmere:jobs_board:job:${jobId}`)
    );
  });
});

describe("mmo_jobs_board_authority — issuers and abuse protections", () => {
  function economyWithBusiness(): HarthmereProductionEconomyState {
    const economy = defaultHarthmereProductionEconomyState();
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
    const result = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload({ issuerKind: "business", businessId: "business_1" }),
      {
        economy,
        actorGold: 0,
        canManageBusinessJobs: (business) =>
          business.businessId === "business_1",
      },
      "owner"
    );
    assert.equal(result.inventoryGoldDelta, 0);
    assert.equal(result.economy!.businesses.business_1.balanceGold, 380);
    assert.equal(
      Object.values(result.jobsBoard.postings)[0].issuerKind,
      "business"
    );
  });

  it("escrows item and collectible rewards upfront, then pays them after the quest is completed", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    const posted = mutate(
      state,
      "create_job_posting",
      postPayload({
        rewardGold: 150,
        rewardItems: [{ itemId: "road_ration", count: 2 }],
        rewardCollectibleIds: ["economy:repair_maintenance_person"],
      }),
      {
        actorGold: 500,
        actorInventoryItems: { road_ration: 2 },
        actorCollectibles: { "economy:repair_maintenance_person": NOW },
      },
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    assert.equal(posted.inventoryGoldDelta, -150);
    assert.deepEqual(posted.inventoryItemDeltas, { road_ration: -2 });
    assert.deepEqual(posted.jobsBoard.postings[jobId].escrowItems, {
      road_ration: 2,
    });

    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const questDone = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    const completed = mutate(
      questDone.jobsBoard,
      "complete_job",
      { jobId },
      {},
      "seeker"
    );
    assert.equal(completed.inventoryGoldDelta, 150);
    assert.deepEqual(completed.inventoryItemDeltas, { road_ration: 2 });
    assert.deepEqual(completed.collectibleRewardIds, [
      "economy:repair_maintenance_person",
    ]);
  });

  it("rejects invalid or unavailable escrow reward items and refunds open item rewards on cancel", () => {
    const unavailable = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload({
        rewardItems: [{ itemId: "road_ration", count: 2 }],
      }),
      { actorInventoryItems: { road_ration: 1 } },
      "poster"
    );
    assert.ok(
      unavailable.warnings.includes(
        "jobs_board_rejected:escrow_item_required:road_ration"
      )
    );

    const invalid = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload({
        rewardItems: [{ itemId: "fake_item", count: 1 }],
      }),
      { actorInventoryItems: { fake_item: 1 } },
      "poster"
    );
    assert.ok(
      invalid.warnings.includes("jobs_board_rejected:invalid_reward_item")
    );

    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload({
        rewardItems: [{ itemId: "road_ration", count: 2 }],
      }),
      { actorInventoryItems: { road_ration: 2 } },
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const cancelled = mutate(
      posted.jobsBoard,
      "cancel_job",
      { jobId },
      {},
      "poster"
    );
    assert.equal(cancelled.inventoryGoldDelta, 120);
    assert.deepEqual(cancelled.inventoryItemDeltas, { road_ration: 2 });
  });

  it("covers every PDF business type with an executable jobs-board template", () => {
    const businessTypes = Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES).sort();
    const templateTypes = Array.from(
      new Set(
        HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.map(
          (template) => template.businessType
        )
      )
    ).sort();
    assert.deepEqual(templateTypes, businessTypes);
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      assert.ok(template.requirements.length > 0, template.templateId);
      assert.ok(template.targetId, template.templateId);
      assert.ok(template.mapMarkerId, template.templateId);
      assert.ok(
        harthmereJobsBoardQuestMarkerPositionForId(template.mapMarkerId),
        `${template.templateId} map marker must resolve to a world coordinate`
      );
      assert.ok(
        template.defaultRewardGold >= 5 && template.defaultRewardGold <= 5000,
        template.templateId
      );
      for (const req of template.requirements) {
        if (req.itemId)
          assert.ok(
            isKnownHarthmereJobsBoardExecutableItemId(req.itemId),
            `${template.templateId}:${req.itemId}`
          );
        assert.ok(
          req.itemId || req.serviceKind || req.targetId,
          template.templateId
        );
      }
    }
  });

  it("lets each business template create an executable business-backed job when the business owns escrow", () => {
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      const economy = economyWithBusiness();
      economy.businesses.business_1.typeId = template.businessType;
      economy.businesses.business_1.inventory = {
        road_ration: { itemId: "road_ration", count: 10 },
      };
      const result = mutate(
        defaultHarthmereJobsBoardState(NOW),
        "create_job_posting",
        {
          templateId: template.templateId,
          issuerKind: "business",
          businessId: "business_1",
        },
        {
          economy,
          actorGold: 0,
          canManageBusinessJobs: (business) =>
            business.businessId === "business_1",
        },
        "owner"
      );
      assert.deepEqual(result.warnings, [], template.templateId);
      const job = Object.values(result.jobsBoard.postings)[0];
      assert.equal(job.templateId, template.templateId);
      assert.equal(job.kind, template.kind);
      assert.equal(
        JSON.stringify(job.requirements),
        JSON.stringify(template.requirements)
      );

      const accepted = mutate(
        result.jobsBoard,
        "accept_job",
        { jobId: job.jobId },
        {},
        "seeker"
      );
      assert.deepEqual(accepted.warnings, [], `${template.templateId}:accept`);
      const actorInventoryItems: Record<string, number> = {};
      for (const req of template.requirements) {
        if (req.itemId) actorInventoryItems[req.itemId] = req.count ?? 1;
      }
      const authoritativeEquippedToolActions = template.requirements
        .map((requirement) => requirement.requiredToolAction)
        .filter((action): action is string => Boolean(action));
      const questDone = mutate(
        accepted.jobsBoard,
        "complete_job_quest",
        { jobId: job.jobId, completedTargetId: template.targetId },
        { actorInventoryItems, authoritativeEquippedToolActions },
        "seeker"
      );
      assert.deepEqual(questDone.warnings, [], `${template.templateId}:quest`);
      const completed = mutate(
        questDone.jobsBoard,
        "complete_job",
        { jobId: job.jobId },
        {},
        "seeker"
      );
      assert.deepEqual(
        completed.warnings,
        [],
        `${template.templateId}:turn-in`
      );
      assert.equal(completed.jobsBoard.postings[job.jobId].status, "completed");
      assert.equal(completed.inventoryGoldDelta, template.defaultRewardGold);
    }
  });

  it("rejects unauthorized business/guild/town/npc posting", () => {
    const economy = economyWithBusiness();
    assert.ok(
      mutate(
        defaultHarthmereJobsBoardState(NOW),
        "create_job_posting",
        postPayload({ issuerKind: "business", businessId: "business_1" }),
        { economy, canManageBusinessJobs: () => false },
        "not_owner"
      ).warnings.includes(
        "jobs_board_rejected:business_job_permission_required"
      )
    );
    assert.ok(
      mutate(
        defaultHarthmereJobsBoardState(NOW),
        "create_job_posting",
        postPayload({ issuerKind: "guild", issuerId: "guild_1" }),
        { canManageGuildJobs: () => false },
        "officer"
      ).warnings.includes("jobs_board_rejected:guild_job_permission_required")
    );
    assert.ok(
      mutate(
        defaultHarthmereJobsBoardState(NOW),
        "create_job_posting",
        postPayload({ issuerKind: "town", issuerId: "harthmere_grove" }),
        { canManageTownJobs: () => false },
        "clerk"
      ).warnings.includes("jobs_board_rejected:town_job_permission_required")
    );
    assert.ok(
      mutate(
        defaultHarthmereJobsBoardState(NOW),
        "create_job_posting",
        postPayload({ issuerKind: "npc", issuerId: "npc_1" }),
        { allowNpcJobPosting: false },
        "npc_admin"
      ).warnings.includes("jobs_board_rejected:npc_job_permission_required")
    );
  });

  it("enforces reward caps, cooldowns, active seeker limits, issuer limits, and suspicious text flags", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    assert.ok(
      mutate(
        state,
        "create_job_posting",
        postPayload({ rewardGold: 1 }),
        {},
        "poster"
      ).warnings.includes("jobs_board_rejected:reward_too_low")
    );
    assert.ok(
      mutate(
        state,
        "create_job_posting",
        postPayload({ rewardGold: 999999 }),
        {},
        "poster"
      ).warnings.includes("jobs_board_rejected:reward_too_high")
    );
    const first = reduceHarthmereJobsBoardMutation(
      state,
      {
        requestId: "first",
        actorId: "poster",
        nowMs: NOW,
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        ...postPayload({ title: "Free gold exploit http://bad.example" }),
      } as any,
      context()
    );
    const job = Object.values(first.jobsBoard.postings)[0];
    assert.deepEqual(job.abuseFlags, ["suspicious_text"]);
    const cooldown = reduceHarthmereJobsBoardMutation(
      first.jobsBoard,
      {
        requestId: "second",
        actorId: "poster",
        nowMs: NOW + 1,
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        ...postPayload({ title: "Second" }),
      } as any,
      context()
    );
    assert.ok(cooldown.warnings.includes("jobs_board_rejected:post_cooldown"));

    let limited = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 12; i++) {
      const r = reduceHarthmereJobsBoardMutation(
        limited,
        {
          requestId: `p${i}`,
          actorId: "issuer",
          nowMs: NOW + i * 20_000,
          operation: "create_job_posting",
          boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
          ...postPayload({ title: `Job ${i}` }),
        } as any,
        context({ actorGold: 100000 })
      );
      limited = r.jobsBoard;
    }
    assert.ok(
      reduceHarthmereJobsBoardMutation(
        limited,
        {
          requestId: "too_many",
          actorId: "issuer",
          nowMs: NOW + 999_999,
          operation: "create_job_posting",
          boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
          ...postPayload({ title: "too many" }),
        } as any,
        context({ actorGold: 100000 })
      ).warnings.includes("jobs_board_rejected:issuer_posting_limit")
    );
  });

  it("cancels open jobs with escrow refund and marks active cancellations as failed to prevent bait-and-switch abuse", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const cancelled = mutate(
      posted.jobsBoard,
      "cancel_job",
      { jobId },
      {},
      "poster"
    );
    assert.equal(cancelled.jobsBoard.postings[jobId].status, "cancelled");
    assert.equal(cancelled.inventoryGoldDelta, 120);

    const posted2 = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster2"
    );
    const job2 = Object.keys(posted2.jobsBoard.postings)[0];
    const active = mutate(
      posted2.jobsBoard,
      "accept_job",
      { jobId: job2 },
      {},
      "seeker"
    );
    const failed = mutate(
      active.jobsBoard,
      "cancel_job",
      { jobId: job2 },
      {},
      "poster2"
    );
    // Active cancellation still records the job as "failed" (anti bait-and-switch), but the
    // escrowed reward must return to the issuer rather than being silently destroyed.
    assert.equal(failed.jobsBoard.postings[job2].status, "failed");
    assert.equal(failed.inventoryGoldDelta, 120);
    assert.equal(
      failed.jobsBoard.postings[job2].escrowGold,
      0,
      "escrow must be cleared after refund"
    );
  });
});

describe("mmo_jobs_board_authority — abandon + failure penalty (audit hardening)", () => {
  it("lets a seeker abandon an accepted job, returning it to open and charging the failure penalty", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    assert.equal(accepted.jobsBoard.postings[jobId].status, "active");
    const penalty = accepted.jobsBoard.postings[jobId].failurePenaltyGold;
    assert.ok(penalty > 0, "job should carry a failure penalty");

    const abandoned = mutate(
      accepted.jobsBoard,
      "abandon_job",
      { jobId },
      {},
      "seeker"
    );
    assert.deepEqual(abandoned.warnings, []);
    assert.equal(
      abandoned.jobsBoard.postings[jobId].status,
      "open",
      "job returns to the open pool"
    );
    assert.equal(
      abandoned.jobsBoard.postings[jobId].acceptedByActorId,
      undefined
    );
    assert.equal(
      abandoned.inventoryGoldDelta,
      -penalty,
      "seeker pays the failure penalty"
    );

    // The freed job can be accepted by another seeker.
    const reaccepted = mutate(
      abandoned.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker2"
    );
    assert.deepEqual(reaccepted.warnings, []);
    assert.equal(
      reaccepted.jobsBoard.postings[jobId].acceptedByActorId,
      "seeker2"
    );
  });

  it("rejects abandon from an actor who did not accept the job", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const r = mutate(accepted.jobsBoard, "abandon_job", { jobId }, {}, "other");
    assert.ok(
      r.warnings.includes("jobs_board_rejected:job_not_accepted_by_actor")
    );
  });
});

describe("mmo_jobs_board_authority — repair-tool completion gate (HARTHMERE_REPAIR_TOOL_COMPLETION)", () => {
  function repairPostPayload() {
    return postPayload({
      title: "Patch the fence",
      requirements: [
        { itemId: "repair_part", count: 1, requiredToolAction: "repair" },
      ],
    });
  }

  it("blocks completing a repair job when the repair tool was not used", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      repairPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const result = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      { actorInventoryItems: { repair_part: 1 } },
      "seeker"
    );
    assert.ok(
      result.warnings.includes(
        "jobs_board_rejected:missing_required_tool:repair"
      ),
      `expected missing_required_tool, got ${JSON.stringify(result.warnings)}`
    );
  });

  it("does not trust a client-reported tool action without equipped-tool evidence", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      repairPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const result = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, usedToolAction: "repair" },
      { actorInventoryItems: { repair_part: 1 } },
      "seeker"
    );
    assert.ok(
      result.warnings.includes(
        "jobs_board_rejected:missing_required_tool:repair"
      )
    );
  });

  it("completes a repair job when native equipped-tool evidence matches", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      repairPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const result = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      {
        actorInventoryItems: { repair_part: 1 },
        authoritativeEquippedToolActions: ["repair"],
      },
      "seeker"
    );
    assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
    const todo = Object.values(result.jobsBoard.todos).find(
      (t) => t.jobId === jobId
    );
    assert.equal(todo?.status, "completed");
  });
});

describe("mmo_jobs_board_authority — field target proximity", () => {
  it("rejects a field posting whose world marker cannot be resolved", () => {
    const result = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload({ mapMarkerId: "client_only_unknown_marker" }),
      {},
      "poster"
    );
    assert.ok(
      result.warnings.includes("jobs_board_rejected:field_marker_unresolvable")
    );
    assert.equal(result.inventoryGoldDelta, 0);
    assert.equal(Object.keys(result.jobsBoard.postings).length, 0);
  });

  it("requires a verified position at the authored field marker", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const unverified = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, completedTargetId: "pump_1" },
      { actorPosition: undefined, actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    assert.ok(
      unverified.warnings.includes(
        "jobs_board_rejected:field_position_unverified"
      )
    );

    const remote = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, completedTargetId: "pump_1" },
      {
        actorPosition: { x: 100_000, y: 100_000, z: 100_000 },
        actorInventoryItems: { repair_part: 2 },
      },
      "seeker"
    );
    assert.ok(
      remote.warnings.includes("jobs_board_rejected:field_target_out_of_range")
    );
  });

  it("accepts a grounded player at the marker XZ when terrain scan Y is stale", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      posted.jobsBoard.postings[jobId].mapMarkerId
    );
    assert.ok(marker);
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const completed = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, completedTargetId: "pump_1" },
      {
        actorPosition: {
          x: marker.position[0],
          // Production terrain placement recommendations can be about 11m
          // above the controller's actual walkable floor.
          y: marker.position[1] - 11,
          z: marker.position[2],
        },
        actorInventoryItems: { repair_part: 2 },
      },
      "seeker"
    );
    assert.equal(
      completed.warnings.length,
      0,
      JSON.stringify(completed.warnings)
    );
    assert.equal(
      Object.values(completed.jobsBoard.todos)[0].status,
      "completed"
    );
  });
});

describe("mmo_jobs_board_authority — accept timer + failure (HARTHMERE_JOB_ACCEPT_TIMER)", () => {
  function postAndAccept(acceptNowMs: number) {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId, nowMs: acceptNowMs },
      {},
      "seeker"
    );
    return { jobId, state: accepted.jobsBoard };
  }

  it("keeps non-escort accepted timers in the existing few-hours-to-day range", () => {
    const acceptNow = NOW;
    const { jobId, state } = postAndAccept(acceptNow);
    const job = state.postings[jobId];
    const window = job.deadlineAtMs - acceptNow;
    assert.ok(
      window >= HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MIN_MS &&
        window <= HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MAX_MS,
      `accept window ${window}ms out of range`
    );
    const todo = Object.values(state.todos).find((t) => t.jobId === jobId);
    assert.equal(
      todo?.dueAtMs,
      job.deadlineAtMs,
      "todo inherits the accept deadline"
    );
  });

  it("starts escort accepted timers in the 2-5 hour range and creates a companion", () => {
    const acceptNow = NOW;
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      escortPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId, nowMs: acceptNow },
      {
        actorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
      },
      "seeker"
    );
    const job = accepted.jobsBoard.postings[jobId];
    const window = job.deadlineAtMs - acceptNow;
    assert.ok(
      window >= HARTHMERE_ESCORT_ACCEPT_WINDOW_MIN_MS &&
        window <= HARTHMERE_ESCORT_ACCEPT_WINDOW_MAX_MS,
      `escort accept window ${window}ms out of range`
    );
    assert.ok(job.escortCompanion, "escort accept should attach a companion");
    assert.equal(job.escortCompanion!.displayName, "Newcomer");
    assert.equal(job.escortCompanion!.status, "following");
    assert.ok(job.escortCompanion!.position.x > 501.99);
    assert.equal(
      Object.values(accepted.jobsBoard.todos).find((t) => t.jobId === jobId)
        ?.dueAtMs,
      job.deadlineAtMs
    );
  });

  it("reactivates a stale failed todo when the same actor re-accepts a released job", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const firstTodo = Object.values(accepted.jobsBoard.todos).find(
      (todo) => todo.jobId === jobId && todo.actorId === "seeker"
    );
    assert.ok(firstTodo);

    const failed = mutate(
      accepted.jobsBoard,
      "fail_job_quest",
      { jobId, questTodoId: firstTodo!.todoId },
      {},
      "seeker"
    );
    assert.equal(failed.jobsBoard.postings[jobId].status, "open");
    assert.equal(failed.jobsBoard.todos[firstTodo!.todoId].status, "failed");

    const reaccepted = mutate(
      failed.jobsBoard,
      "accept_job",
      { jobId, nowMs: NOW + HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS * 2 },
      {},
      "seeker"
    );
    assert.equal(
      reaccepted.warnings.length,
      0,
      JSON.stringify(reaccepted.warnings)
    );
    assert.equal(reaccepted.jobsBoard.postings[jobId].status, "active");
    assert.equal(
      reaccepted.jobsBoard.todos[firstTodo!.todoId].status,
      "active"
    );

    const questDone = mutate(
      reaccepted.jobsBoard,
      "complete_job_quest",
      {
        jobId,
        questTodoId: firstTodo!.todoId,
        completedTargetId: "pump_1",
      },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );
    assert.equal(questDone.warnings.length, 0);
    assert.equal(
      questDone.jobsBoard.todos[firstTodo!.todoId].status,
      "completed"
    );
  });

  it("does not resurrect a cancelled todo when the accepted job is still active", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      postPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const todo = Object.values(accepted.jobsBoard.todos).find(
      (candidate) => candidate.jobId === jobId && candidate.actorId === "seeker"
    );
    assert.ok(todo);
    accepted.jobsBoard.todos[todo!.todoId].status = "cancelled";

    const questDone = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      {
        jobId,
        questTodoId: todo!.todoId,
        completedTargetId: "pump_1",
      },
      { actorInventoryItems: { repair_part: 2 } },
      "seeker"
    );

    assert.ok(
      questDone.warnings.includes(
        "jobs_board_rejected:quest_not_active:cancelled"
      ),
      JSON.stringify(questDone.warnings)
    );
    assert.equal(questDone.jobsBoard.todos[todo!.todoId].status, "cancelled");
  });

  it("does not complete an escort quest until the companion has arrived", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      escortPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const early = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, completedTargetId: "old_grove_road_post" },
      {},
      "seeker"
    );
    assert.ok(
      early.warnings.includes(
        "jobs_board_rejected:escort_companion_not_arrived"
      )
    );
    accepted.jobsBoard.postings[jobId].escortCompanion!.status = "arrived";
    const completed = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId, completedTargetId: "old_grove_road_post" },
      {},
      "seeker"
    );
    assert.equal(
      completed.warnings.length,
      0,
      JSON.stringify(completed.warnings)
    );
    assert.equal(
      Object.values(completed.jobsBoard.todos)[0].status,
      "completed"
    );
  });

  it("on the next interaction after the window lapses: marks the todo FAILED, releases the job to open, frees the slot", () => {
    const acceptNow = NOW;
    const { jobId, state } = postAndAccept(acceptNow);
    const lapsedNow = acceptNow + HARTHMERE_JOBS_BOARD_ACCEPT_WINDOW_MAX_MS + 1;
    // Any mutation runs the lazy sweep first. Use a harmless accept attempt by another seeker.
    const after = mutate(
      state,
      "accept_job",
      { jobId, nowMs: lapsedNow },
      {},
      "seeker2"
    );
    const job = after.jobsBoard.postings[jobId];
    const todo = Object.values(after.jobsBoard.todos).find(
      (t) => t.actorId === "seeker" && t.jobId === jobId
    );
    assert.equal(todo?.status, "failed", "lapsed todo is FAILED");
    // The original seeker's claim was released; seeker2 then re-accepted it.
    assert.equal(job.acceptedByActorId, "seeker2");
  });

  it("fail_job_quest fails the actor's quest and releases the job (e.g. escorted NPC killed)", () => {
    const { jobId, state } = postAndAccept(NOW);
    const failed = mutate(state, "fail_job_quest", { jobId }, {}, "seeker");
    assert.equal(failed.warnings.length, 0, JSON.stringify(failed.warnings));
    const todo = Object.values(failed.jobsBoard.todos).find(
      (t) => t.jobId === jobId && t.actorId === "seeker"
    );
    assert.equal(todo?.status, "failed");
    assert.equal(failed.jobsBoard.postings[jobId].status, "open");
    assert.equal(failed.jobsBoard.postings[jobId].acceptedByActorId, undefined);
  });

  it("time-remaining label formats hours/minutes and Expired", () => {
    assert.equal(
      formatHarthmereJobTimeRemaining(
        1000 + 3 * 60 * 60 * 1000 + 12 * 60 * 1000,
        1000
      ),
      "3h 12m left"
    );
    assert.equal(
      formatHarthmereJobTimeRemaining(1000 + 9 * 60 * 1000, 1000),
      "9m left"
    );
    assert.equal(formatHarthmereJobTimeRemaining(500, 1000), "Expired");
    assert.equal(formatHarthmereJobTimeRemaining(undefined, 1000), "");
  });
});

describe("mmo_jobs_board_authority — delivery (HARTHMERE_DELIVERY)", () => {
  describe("harthmereDeliveryPlan", () => {
    it("returns undefined for non-delivery jobs", () => {
      assert.equal(
        harthmereDeliveryPlan({
          kind: "repair",
          requirements: [{ itemId: "x" }],
        }),
        undefined
      );
    });

    it("grants the parcel on accept for a person recipient with no pickup", () => {
      const plan = harthmereDeliveryPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "sealed_package",
            count: 1,
            recipientNpcId: "npc_outpost_brightcart_trader",
          },
        ],
      });
      assert.ok(plan);
      assert.equal(plan?.grantOnAccept, true);
      assert.equal(plan?.parcelItemId, "sealed_package");
      assert.deepEqual(plan?.recipient, {
        kind: "person",
        ownerNpcId: "npc_outpost_brightcart_trader",
        markerId: "harthmere_owner:npc_outpost_brightcart_trader",
      });
    });

    it("requires pickup (no grant on accept) when a pickup location is set", () => {
      const plan = harthmereDeliveryPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "courier_pouch",
            count: 1,
            recipientNpcId: "npc_outpost_stampspur_dispatcher",
            pickupMarkerId: "harthmere_bridge_center",
          },
        ],
      });
      assert.equal(plan?.grantOnAccept, false);
      assert.equal(plan?.pickupMarkerId, "harthmere_bridge_center");
    });

    it("treats a recipient-less delivery as a place delivery", () => {
      const plan = harthmereDeliveryPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "apple_basket",
            count: 1,
            mapMarkerId: "grove_mail_bank_satchel",
          },
        ],
      });
      assert.deepEqual(plan?.recipient, {
        kind: "place",
        markerId: "grove_mail_bank_satchel",
      });
      assert.equal(plan?.grantOnAccept, true);
    });
  });

  function deliveryPostPayload() {
    return postPayload({
      title: "Deliver pouch to Odette",
      kind: "delivery",
      requirements: [
        {
          itemId: "repair_part",
          count: 1,
          recipientNpcId: "npc_outpost_brightcart_trader",
        },
      ],
    });
  }

  it("blocks a delivery without server-observed recipient evidence", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      deliveryPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    const result = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      {
        actorInventoryItems: { repair_part: 1 },
        authoritativeCompletedTargetIds: [],
      },
      "seeker"
    );
    assert.ok(
      result.warnings.some((w) => w.includes("not_delivered_to_recipient")),
      JSON.stringify(result.warnings)
    );
  });

  it("completes a person-delivery at the server-observed recipient", () => {
    const posted = mutate(
      defaultHarthmereJobsBoardState(NOW),
      "create_job_posting",
      deliveryPostPayload(),
      {},
      "poster"
    );
    const jobId = Object.keys(posted.jobsBoard.postings)[0];
    const accepted = mutate(
      posted.jobsBoard,
      "accept_job",
      { jobId },
      {},
      "seeker"
    );
    assert.deepEqual(accepted.inventoryItemDeltas, { repair_part: 1 });
    const result = mutate(
      accepted.jobsBoard,
      "complete_job_quest",
      { jobId },
      { actorInventoryItems: { repair_part: 1 } },
      "seeker"
    );
    assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
    const todo = Object.values(result.jobsBoard.todos).find(
      (t) => t.jobId === jobId
    );
    assert.equal(todo?.status, "completed");
  });
});
