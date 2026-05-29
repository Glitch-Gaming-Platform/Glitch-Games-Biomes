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
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR_V141,
  defaultHarthmereJobsBoardStateV1,
  reduceHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardMutationContextV1,
  type HarthmereJobsBoardStateV1,
} from "../mmo_jobs_board_authority_v1";
import {
  defaultHarthmereProductionEconomyStateV1,
  type HarthmereProductionEconomyStateV1,
} from "../mmo_economy_authority_v1";

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
  return reduceHarthmereJobsBoardMutationV1(
    state,
    {
      requestId: `auto_seed_${nowMs}`,
      actorId: "economy_seeder",
      nowMs,
      operation: "economy_auto_seed_jobs",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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

    const complete = reduceHarthmereJobsBoardMutationV1(
      accept.jobsBoard,
      {
        requestId: "complete",
        actorId: "seeker",
        nowMs: NOW + 2_000,
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        jobId: job.jobId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems,
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      },
    );
    assert.equal(complete.jobsBoard.postings[job.jobId].status, "completed");
    assert.equal(complete.inventoryGoldDelta, job.rewardGold);
  });
});
