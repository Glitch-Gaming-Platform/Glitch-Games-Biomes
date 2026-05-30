/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141 tests.
// Cover:
//   - Auto-seeder produces N jobs up to the board target.
//   - Jobs flagged autoPosted + source = "economy_auto_seed".
//   - Auto-seeder is idempotent for the same nowMs (deterministic templates).
//   - Auto-seeder stops once target open count is reached.
//   - Monster-hunt postings carry partyRecommended + monsterTier + lootHint
//     and pay reward >= floor.
//   - Business-issued auto jobs debit business balance and skip when
//     business has insufficient funds.
//   - Auto-posted jobs flow through accept / complete normally.
//   - Rejects unknown board.
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN_V141,
  HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK_V141,
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
  HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1,
  HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR_V141,
  defaultHarthmereJobsBoardStateV1,
  isHarthmereExoticMatterMiningTemplateIdV1,
  reduceHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardMutationContextV1,
  type HarthmereJobsBoardStateV1,
} from "../mmo_jobs_board_authority_v1";
import {
  defaultHarthmereProductionEconomyStateV1,
  type HarthmereProductionEconomyStateV1,
} from "../mmo_economy_authority_v1";
import {
  harthmereJobsBoardQuestMarkerPositionForIdV1,
  unresolvedHarthmereJobsBoardQuestMarkerIdsV1,
} from "../jobs_board_quest_marker_positions_v1";
import {
  HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS_V1,
  harthmereExoticMatterDepositByIdV1,
  isHarthmereExoticMatterMaterialItemIdV1,
} from "../exotic_matter_caves_v1";
import { isKnownHarthmereJobsBoardExecutableItemIdV146 } from "../jobs_board_business_templates_v146";

const NOW = 1_800_000_000_000;

function seedContext(overrides: Partial<HarthmereJobsBoardMutationContextV1> = {}): HarthmereJobsBoardMutationContextV1 {
  return {
    actorGold: 0,
    actorInventoryItems: {},
    nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    ...overrides,
  };
}

function seed(
  state: HarthmereJobsBoardStateV1,
  nowMs = NOW,
  ctx: Partial<HarthmereJobsBoardMutationContextV1> = {},
) {
  return seedBoard(state, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, nowMs, ctx);
}

function seedBoard(
  state: HarthmereJobsBoardStateV1,
  boardId: string,
  nowMs = NOW,
  ctx: Partial<HarthmereJobsBoardMutationContextV1> = {},
) {
  return reduceHarthmereJobsBoardMutationV1(
    state,
    {
      requestId: `auto_seed_${nowMs}`,
      actorId: "economy_seeder",
      nowMs,
      operation: "economy_auto_seed_jobs",
      boardId,
    } as any,
    seedContext(ctx),
  );
}

function autoPostings(state: HarthmereJobsBoardStateV1) {
  return Object.values(state.postings).filter((job) => job.autoPosted);
}

describe("mmo_jobs_board_authority_v1 — economy auto-seed (V141)", () => {
  it("produces up to MAX_PER_TICK new auto-posted jobs on the default board", () => {
    const result = seed(defaultHarthmereJobsBoardStateV1(NOW));
    const auto = autoPostings(result.jobsBoard);
    assert.ok(auto.length > 0, "auto-seeder produced no jobs");
    assert.ok(
      auto.length <= HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK_V141,
      `auto-seeder produced ${auto.length} > MAX_PER_TICK`,
    );
    for (const job of auto) {
      assert.equal(job.status, "open");
      assert.equal(job.autoPosted, true);
      assert.equal(job.source, "economy_auto_seed");
      assert.ok(job.rewardGold >= 5);
      assert.ok(job.escrowGold === job.rewardGold);
      assert.equal(job.boardId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
    }
  });

  it("is deterministic for a given nowMs (same input → same job ids and templates)", () => {
    const a = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW);
    const b = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW);
    const idsA = Object.keys(a.jobsBoard.postings).sort();
    const idsB = Object.keys(b.jobsBoard.postings).sort();
    assert.deepEqual(idsA, idsB);
    const titlesA = Object.values(a.jobsBoard.postings).map((j) => j.title).sort();
    const titlesB = Object.values(b.jobsBoard.postings).map((j) => j.title).sort();
    assert.deepEqual(titlesA, titlesB);
  });

  it("stops seeding once the board has TARGET_OPEN auto-posted open jobs", () => {
    let state = defaultHarthmereJobsBoardStateV1(NOW);
    // Run enough ticks to saturate the board.
    for (let i = 0; i < 20; i++) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const open = autoPostings(state).filter((job) => job.status === "open").length;
    assert.ok(
      open <= HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN_V141,
      `auto-seeder overshot target: ${open}`,
    );
    // After saturation, one more tick should be a no-op for new postings.
    const before = Object.keys(state.postings).length;
    const after = seed(state, NOW + 9_000_000).jobsBoard;
    assert.equal(Object.keys(after.postings).length, before);
  });

  it("never overwrites an existing posting when the saved job counter is stale", () => {
    const state = defaultHarthmereJobsBoardStateV1(NOW);
    state.nextJobNumber = 1;
    state.postings.harthmere_auto_1 = {
      jobId: "harthmere_auto_1",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Persisted errand",
      description: "Already saved before this read tick.",
      kind: "delivery",
      requirements: [{ itemId: "route_note", count: 1 }],
      rewardGold: 40,
      escrowGold: 40,
      reputationDelta: 1,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW - 1_000,
      deadlineAtMs: NOW + 86_400_000,
      failurePenaltyGold: 4,
      requiresFieldWork: true,
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
    };

    const result = seed(state, NOW + 7_000);

    assert.equal(
      result.jobsBoard.postings.harthmere_auto_1.title,
      "Persisted errand",
    );
    assert.ok(
      Object.keys(result.jobsBoard.postings).some((id) => id !== "harthmere_auto_1"),
      "auto-seed should allocate a fresh id instead of replacing saved state",
    );
  });

  it("rejects auto-seed against an unknown board id", () => {
    const result = reduceHarthmereJobsBoardMutationV1(
      defaultHarthmereJobsBoardStateV1(NOW),
      {
        requestId: "bad_board",
        actorId: "economy_seeder",
        nowMs: NOW,
        operation: "economy_auto_seed_jobs",
        boardId: "no_such_board",
      } as any,
      seedContext(),
    );
    assert.ok(result.warnings.some((w) => w.includes("unknown_board")));
    assert.equal(Object.keys(result.jobsBoard.postings).length, 0);
  });

  it("debits a business's balance when posting a business-issued auto job and skips when funds are too low", () => {
    const economy = (function makeEconomy(): HarthmereProductionEconomyStateV1 {
      const e = defaultHarthmereProductionEconomyStateV1();
      e.businesses.grove_kettle_inn = {
        businessId: "grove_kettle_inn",
        ownerKind: "player",
        ownerId: "innkeeper",
        typeId: "tavern_innkeeper",
        name: "Grove Kettle Inn",
        status: "open",
        licenseClass: "basic_trade",
        licenseLevel: 1,
        propertyId: "property_inn",
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
        balanceGold: 1000,
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
      return e;
    })();
    const initialBalance = economy.businesses.grove_kettle_inn.balanceGold;
    const result = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW, { economy });
    const businessJob = Object.values(result.jobsBoard.postings).find((j) => j.issuerKind === "business");
    if (businessJob) {
      assert.ok(
        result.economy!.businesses.grove_kettle_inn.balanceGold < initialBalance,
        "business balance not debited for auto-posted job",
      );
      assert.equal(businessJob.issuerId, "grove_kettle_inn");
    }
    // With zero balance, no business postings should appear.
    economy.businesses.grove_kettle_inn.balanceGold = 0;
    const noFundsResult = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW, { economy });
    const businessJobs = Object.values(noFundsResult.jobsBoard.postings).filter((j) => j.issuerKind === "business");
    assert.equal(businessJobs.length, 0, "business job posted despite empty balance");
  });

  it("auto-seeds jobs for real open production businesses and skips closed, underfunded, or already-covered issuers", () => {
    const economy = defaultHarthmereProductionEconomyStateV1();
    economy.businesses.business_general = {
      businessId: "business_general",
      ownerKind: "player",
      ownerId: "merchant",
      typeId: "general_trader",
      name: "General Goods",
      status: "open",
      licenseClass: "basic_trade",
      licenseLevel: 1,
      propertyId: "property_general",
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
      rentGoldPerDay: 0,
      wageGoldPerDay: 0,
      salesTaxRate: 0.06,
      lastTickAtMs: NOW,
      createdAtMs: NOW,
      updatedAtMs: NOW,
      flags: {},
    };
    economy.businesses.business_closed = {
      ...economy.businesses.business_general,
      businessId: "business_closed",
      status: "closed",
      balanceGold: 500,
    };
    economy.businesses.business_broke = {
      ...economy.businesses.business_general,
      businessId: "business_broke",
      balanceGold: 0,
    };

    const first = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW, { economy });
    const businessJobs = Object.values(first.jobsBoard.postings).filter(
      (job) => job.issuerKind === "business" && job.issuerId === "business_general",
    );
    assert.equal(businessJobs.length, 1);
    assert.equal(businessJobs[0].templateId, "general_trader_stock_rations_v146");
    assert.ok(first.economy!.businesses.business_general.balanceGold < 500);
    assert.equal(
      Object.values(first.jobsBoard.postings).some((job) => job.issuerId === "business_closed"),
      false,
    );
    assert.equal(
      Object.values(first.jobsBoard.postings).some((job) => job.issuerId === "business_broke"),
      false,
    );

    const second = seed(first.jobsBoard, NOW + 1_000, { economy: first.economy });
    const repeated = Object.values(second.jobsBoard.postings).filter(
      (job) => job.issuerKind === "business" && job.issuerId === "business_general",
    );
    assert.equal(repeated.length, 1, "auto-seed should not duplicate an active business template job");
  });
});

describe("mmo_jobs_board_authority_v1 — monster hunting (V141)", () => {
  it("produces at least one Mucker or Hex hunt with party flag + loot hint over many ticks", () => {
    let state = defaultHarthmereJobsBoardStateV1(NOW);
    // Run multiple ticks with different nowMs to exercise the rng selection.
    for (let i = 0; i < 30; i++) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const hunts = Object.values(state.postings).filter((job) => job.kind === "hunt");
    assert.ok(hunts.length > 0, "no monster hunt postings appeared across 30 ticks");
    for (const hunt of hunts) {
      assert.ok(["mucker", "hex"].includes(String(hunt.monsterId)), `unexpected monsterId: ${hunt.monsterId}`);
      assert.equal(hunt.partyRecommended, true);
      assert.ok((hunt.partyMinSize ?? 0) >= 3, "party min size should be 3+ for monster hunts");
      assert.ok(["strong", "elite", "boss"].includes(String(hunt.monsterTier)), `monster tier should be strong+, got ${hunt.monsterTier}`);
      assert.ok(
        hunt.rewardGold >= HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR_V141,
        `monster hunt reward ${hunt.rewardGold} below floor`,
      );
      assert.ok(Array.isArray(hunt.lootHint) && hunt.lootHint.length > 0, "monster hunt should advertise loot hint");
    }
  });

  it("resolves every Grove auto-seeded field-work marker to a world coordinate", () => {
    let state = defaultHarthmereJobsBoardStateV1(NOW);
    for (let i = 0; i < 30; i += 1) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const markerIds = Object.values(state.postings)
      .map((job) => job.mapMarkerId)
      .filter((markerId): markerId is string => Boolean(markerId));
    assert.deepEqual(unresolvedHarthmereJobsBoardQuestMarkerIdsV1(markerIds), []);
    const hunt = Object.values(state.postings).find(
      (job) => job.kind === "hunt" && job.mapMarkerId
    );
    assert.ok(hunt, "expected at least one Grove monster hunt marker");
    const marker = harthmereJobsBoardQuestMarkerPositionForIdV1(
      hunt!.mapMarkerId
    );
    assert.ok(marker, `hunt marker should resolve: ${hunt!.mapMarkerId}`);
    assert.notDeepEqual(
      marker!.position,
      [482, 66, -198],
      "monster hunts must not point at the old generic placeholder"
    );
  });

  it("auto-posted jobs accept and complete through the existing pipeline (rewards reach the seeker)", () => {
    const seeded = seed(defaultHarthmereJobsBoardStateV1(NOW), NOW);
    const job = Object.values(seeded.jobsBoard.postings)[0];
    assert.ok(job, "expected at least one seeded job");

    const accept = reduceHarthmereJobsBoardMutationV1(
      seeded.jobsBoard,
      {
        requestId: "accept",
        actorId: "seeker",
        nowMs: NOW + 1_000,
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: job.jobId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems: {},
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
    );
    assert.equal(accept.jobsBoard.postings[job.jobId].status, "active");

    // Build the actor inventory to satisfy whatever the seeded job needs.
    const actorInventoryItems: Record<string, number> = {};
    for (const req of job.requirements) {
      if (req.itemId) actorInventoryItems[req.itemId] = (req.count ?? 1);
    }

    const questDone = reduceHarthmereJobsBoardMutationV1(
      accept.jobsBoard,
      {
        requestId: "quest_done",
        actorId: "seeker",
        nowMs: NOW + 2_000,
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: job.jobId,
        completedTargetId: job.targetId ?? job.requirements.find((req) => req.targetId)?.targetId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems,
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
    );
    assert.equal(questDone.jobsBoard.postings[job.jobId].status, "active");
    assert.equal(Object.values(questDone.jobsBoard.todos).find((todo) => todo.jobId === job.jobId)?.status, "completed");

    const complete = reduceHarthmereJobsBoardMutationV1(
      questDone.jobsBoard,
      {
        requestId: "complete",
        actorId: "seeker",
        nowMs: NOW + 3_000,
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: job.jobId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems: {},
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
    );
    assert.equal(complete.jobsBoard.postings[job.jobId].status, "completed");
    assert.equal(complete.inventoryGoldDelta, job.rewardGold);
  });
});

describe("mmo_jobs_board_authority_v1 — Exotic Matter mining jobs", () => {
  it("registers high-paying Harthmere mining templates for every Exotic Matter material", () => {
    const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141.filter(
      (template) =>
        isHarthmereExoticMatterMiningTemplateIdV1(template.templateId)
    );
    assert.equal(templates.length, 6);

    const itemIds = new Set<string>();
    const deepTemplateIds = new Set<string>();
    for (const template of templates) {
      assert.equal(template.boardScope, "harthmere");
      assert.equal(template.kind, "gather");
      assert.equal(template.requiresFieldWork, true);
      assert.ok(template.rewardGold.min >= 3200, template.templateId);
      assert.equal(template.rewardGold.max, HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1);
      assert.ok(template.mapMarkerId, template.templateId);
      const marker = harthmereJobsBoardQuestMarkerPositionForIdV1(
        template.mapMarkerId
      );
      assert.ok(marker, `${template.templateId} marker should resolve`);
      assert.equal(marker!.source, "exotic_matter_deposit");
      assert.ok(
        !template.mapMarkerId?.includes("windowlight"),
        `${template.templateId} should not target the light/no-job cave`
      );
      const deposit = harthmereExoticMatterDepositByIdV1(template.mapMarkerId);
      assert.ok(deposit, `${template.templateId} should point at a real deposit`);
      assert.equal(deposit!.jobEligible, true);
      if (template.templateId.startsWith("deep_exotic_matter_mine_")) {
        assert.equal(deposit!.caveId, "deep_spindle_massive_cave");
        assert.ok(template.rewardGold.min >= 4600, template.templateId);
        deepTemplateIds.add(template.templateId);
      }
      assert.ok(!template.title.includes("_"), template.title);
      assert.ok(!template.description.includes("_"), template.description);

      for (const requirement of template.requirements) {
        assert.ok(requirement.itemId, template.templateId);
        assert.ok(isHarthmereExoticMatterMaterialItemIdV1(requirement.itemId));
        assert.ok(
          isKnownHarthmereJobsBoardExecutableItemIdV146(requirement.itemId!),
          requirement.itemId
        );
        itemIds.add(requirement.itemId!);
      }
    }
    assert.deepEqual(
      [...itemIds].sort(),
      [...HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS_V1].sort()
    );
    assert.deepEqual(
      [...deepTemplateIds].sort(),
      [
        "deep_exotic_matter_mine_antiboron",
        "deep_exotic_matter_mine_antihelium",
        "deep_exotic_matter_mine_antihydrogen",
      ]
    );
  });

  it("primes the Harthmere board with a random Exotic Matter mining job when none are open", () => {
    const result = seedBoard(
      defaultHarthmereJobsBoardStateV1(NOW),
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
      NOW
    );
    const exoticJob = autoPostings(result.jobsBoard).find((job) =>
      isHarthmereExoticMatterMiningTemplateIdV1(job.templateId)
    );

    assert.ok(exoticJob, "expected random Harthmere seeding to surface an Exotic Matter mining job");
    assert.equal(exoticJob!.boardId, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141);
    assert.ok(exoticJob!.rewardGold >= 3200);
    assert.ok(exoticJob!.requiresFieldWork);
    assert.ok(
      exoticJob!.requirements.some((requirement) =>
        isHarthmereExoticMatterMaterialItemIdV1(requirement.itemId)
      )
    );
  });

  it("can randomly surface every Exotic Matter mining template on the Harthmere board", () => {
    const expected = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141.filter(
      (template) =>
        isHarthmereExoticMatterMiningTemplateIdV1(template.templateId)
    )
      .map((template) => template.templateId)
      .sort();
    const seen = new Set<string>();

    for (let i = 0; i < 500 && seen.size < expected.length; i += 1) {
      const result = seedBoard(
        defaultHarthmereJobsBoardStateV1(NOW),
        HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
        NOW + i * 17_000
      );
      for (const job of autoPostings(result.jobsBoard)) {
        if (isHarthmereExoticMatterMiningTemplateIdV1(job.templateId)) {
          seen.add(job.templateId!);
        }
      }
    }

    assert.deepEqual([...seen].sort(), expected);
  });

  it("does not auto-post Exotic Matter mining jobs on the Grove board", () => {
    let state = defaultHarthmereJobsBoardStateV1(NOW);
    for (let i = 0; i < 20; i += 1) {
      state = seedBoard(
        state,
        HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        NOW + i * 17_000
      ).jobsBoard;
    }

    assert.equal(
      autoPostings(state).some((job) =>
        isHarthmereExoticMatterMiningTemplateIdV1(job.templateId)
      ),
      false
    );
  });
});
