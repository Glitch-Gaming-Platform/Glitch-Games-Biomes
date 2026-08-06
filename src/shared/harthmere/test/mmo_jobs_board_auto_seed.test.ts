/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_AUTO_POSTING tests.
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
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN,
  HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK,
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD,
  HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR,
  HARTHMERE_ESCORT_DESTINATION_MIN_DISTANCE,
  defaultHarthmereJobsBoardState,
  harthmereAutoSeedTemplateRequirementsObtainable,
  isHarthmereExoticMatterMiningTemplateId,
  reduceHarthmereJobsBoardMutation,
  type HarthmereJobsBoardMutationContext,
  type HarthmereJobsBoardState,
} from "../mmo_jobs_board_authority";
import {
  defaultHarthmereProductionEconomyState,
  type HarthmereProductionEconomyState,
} from "../mmo_economy_authority";
import {
  harthmereJobsBoardQuestMarkerPositionForId,
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
  unresolvedHarthmereJobsBoardQuestMarkerIds,
} from "../jobs_board_quest_marker_positions";
import {
  harthmereJobsBoardMuckBountyTargetForId,
  validateHarthmereJobsBoardMuckBountyTargets,
} from "../jobs_board_muck_bounty_targets";
import { muckMonsterAreaForPosition } from "../muck_monster_aggression_ai";
import {
  HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS,
  harthmereExoticMatterDepositById,
  isHarthmereExoticMatterMaterialItemId,
} from "../exotic_matter_caves";
import { isKnownHarthmereJobsBoardExecutableItemId } from "../jobs_board_business_templates";
import { CH1_GROVE_JOB_TEMPLATE_IDS } from "../ch1_interaction_surfaces";

const NOW = 1_800_000_000_000;

function fieldCompletionContext(
  job: HarthmereJobsBoardState["postings"][string],
  overrides: Partial<HarthmereJobsBoardMutationContext> = {}
) {
  const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
    job.mapMarkerId ??
      job.requirements.find((requirement) => requirement.mapMarkerId)
        ?.mapMarkerId ??
      job.targetId
  );
  return seedContext({
    ...(marker
      ? {
          actorPosition: {
            x: marker.position[0],
            y: marker.position[1],
            z: marker.position[2],
          },
        }
      : {}),
    ...overrides,
  });
}

function seedContext(
  overrides: Partial<HarthmereJobsBoardMutationContext> = {}
): HarthmereJobsBoardMutationContext {
  return {
    actorGold: 0,
    actorInventoryItems: {},
    nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    ...overrides,
  };
}

function seed(
  state: HarthmereJobsBoardState,
  nowMs = NOW,
  ctx: Partial<HarthmereJobsBoardMutationContext> = {}
) {
  return seedBoard(state, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID, nowMs, ctx);
}

function seedBoard(
  state: HarthmereJobsBoardState,
  boardId: string,
  nowMs = NOW,
  ctx: Partial<HarthmereJobsBoardMutationContext> = {}
) {
  return reduceHarthmereJobsBoardMutation(
    state,
    {
      requestId: `auto_seed_${nowMs}`,
      actorId: "economy_seeder",
      nowMs,
      operation: "economy_auto_seed_jobs",
      boardId,
    } as any,
    seedContext(ctx)
  );
}

function autoPostings(state: HarthmereJobsBoardState) {
  return Object.values(state.postings).filter((job) => job.autoPosted);
}

/**
 * Seed a board repeatedly the way a LIVE board actually advances.
 *
 * HARTHMERE_JOBS_BOARD_SEED_DETERMINISM changed where variety comes from.
 *
 * These variety tests used to re-seed a FRESH `defaultHarthmereJobsBoardState`
 * while advancing `nowMs`, because the draw was seeded from the wall clock. That
 * clock dependency was a critical bug: `live_mode_jobs_board_state.ts` seeds on
 * every GET without persisting, so a job id named a different job on every poll
 * and accept-by-id bound the wrong posting.
 *
 * The draw is now a function of durable state — the board id and the
 * `nextJobNumber` about to be issued — so advancing only the clock correctly
 * produces the same board every time, and a test that varies only the clock is
 * asserting the bug.
 *
 * Variety in production comes from the board MOVING: jobs are posted, then
 * completed or expired, and the counter advances. This helper models that —
 * seed, drain, repeat — which is both a truer simulation than the old loop and
 * the reason the properties below still hold. Measured: all six Exotic Matter
 * templates surface within 50 rounds, and `hunt_mucker_elite` rotates through
 * seven distinct live coordinates in 60.
 */
function seedLiveBoardRounds(
  boardId: string,
  rounds: number,
  visit: (state: HarthmereJobsBoardState) => void,
  shouldStop?: () => boolean
) {
  let state = defaultHarthmereJobsBoardState(NOW);
  for (let round = 0; round < rounds; round += 1) {
    if (shouldStop?.()) return;
    state = seedBoard(state, boardId, NOW + round * 17_000).jobsBoard;
    visit(state);
    // Drain the board as completion/expiry would, leaving `nextJobNumber`
    // advanced. Without this the board sits at its open-job target and stops
    // seeding entirely, which is correct behaviour but tests nothing.
    state = JSON.parse(JSON.stringify(state)) as HarthmereJobsBoardState;
    for (const jobId of Object.keys(state.postings)) {
      delete state.postings[jobId];
    }
    state.issuerOpenJobIds = {};
  }
}

describe("mmo_jobs_board_authority — economy auto-seed (current)", () => {
  it("produces up to MAX_PER_TICK new auto-posted jobs on the default board", () => {
    const result = seed(defaultHarthmereJobsBoardState(NOW));
    const auto = autoPostings(result.jobsBoard);
    assert.ok(auto.length > 0, "auto-seeder produced no jobs");
    assert.ok(
      auto.length <= HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK,
      `auto-seeder produced ${auto.length} > MAX_PER_TICK`
    );
    for (const job of auto) {
      assert.equal(job.status, "open");
      assert.equal(job.autoPosted, true);
      assert.equal(job.source, "economy_auto_seed");
      assert.ok(job.rewardGold >= 5);
      assert.ok(job.escrowGold === job.rewardGold);
      assert.equal(job.boardId, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
    }
  });

  it("always primes the three Chapter 1 Grove jobs before generic work", () => {
    const result = seed(defaultHarthmereJobsBoardState(NOW));
    const templateIds = new Set(
      autoPostings(result.jobsBoard).map((job) => job.templateId)
    );
    assert.deepEqual(
      CH1_GROVE_JOB_TEMPLATE_IDS.filter(
        (templateId) => !templateIds.has(templateId)
      ),
      []
    );
  });

  it("is deterministic for a given nowMs (same input → same job ids and templates)", () => {
    const a = seed(defaultHarthmereJobsBoardState(NOW), NOW);
    const b = seed(defaultHarthmereJobsBoardState(NOW), NOW);
    const idsA = Object.keys(a.jobsBoard.postings).sort();
    const idsB = Object.keys(b.jobsBoard.postings).sort();
    assert.deepEqual(idsA, idsB);
    const titlesA = Object.values(a.jobsBoard.postings)
      .map((j) => j.title)
      .sort();
    const titlesB = Object.values(b.jobsBoard.postings)
      .map((j) => j.title)
      .sort();
    assert.deepEqual(titlesA, titlesB);
  });

  it("stops seeding once the board has TARGET_OPEN auto-posted open jobs", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    // Run enough ticks to saturate the board.
    for (let i = 0; i < 20; i++) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const open = autoPostings(state).filter(
      (job) => job.status === "open"
    ).length;
    assert.ok(
      open <= HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN,
      `auto-seeder overshot target: ${open}`
    );
    // After saturation, one more tick should be a no-op for new postings.
    const before = Object.keys(state.postings).length;
    const after = seed(state, NOW + 9_000_000).jobsBoard;
    assert.equal(Object.keys(after.postings).length, before);
  });

  it("never overwrites an existing posting when the saved job counter is stale", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    state.nextJobNumber = 1;
    state.postings.harthmere_auto_1 = {
      jobId: "harthmere_auto_1",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
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
      "Persisted errand"
    );
    assert.ok(
      Object.keys(result.jobsBoard.postings).some(
        (id) => id !== "harthmere_auto_1"
      ),
      "auto-seed should allocate a fresh id instead of replacing saved state"
    );
  });

  it("rejects auto-seed against an unknown board id", () => {
    const result = reduceHarthmereJobsBoardMutation(
      defaultHarthmereJobsBoardState(NOW),
      {
        requestId: "bad_board",
        actorId: "economy_seeder",
        nowMs: NOW,
        operation: "economy_auto_seed_jobs",
        boardId: "no_such_board",
      } as any,
      seedContext()
    );
    assert.ok(result.warnings.some((w) => w.includes("unknown_board")));
    assert.equal(Object.keys(result.jobsBoard.postings).length, 0);
  });

  it("debits a business's balance when posting a business-issued auto job and skips when funds are too low", () => {
    const economy = (function makeEconomy(): HarthmereProductionEconomyState {
      const e = defaultHarthmereProductionEconomyState();
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
    const result = seed(defaultHarthmereJobsBoardState(NOW), NOW, { economy });
    const businessJob = Object.values(result.jobsBoard.postings).find(
      (j) => j.issuerKind === "business"
    );
    if (businessJob) {
      assert.ok(
        result.economy!.businesses.grove_kettle_inn.balanceGold <
          initialBalance,
        "business balance not debited for auto-posted job"
      );
      assert.equal(businessJob.issuerId, "grove_kettle_inn");
    }
    // With zero balance, no business postings should appear.
    economy.businesses.grove_kettle_inn.balanceGold = 0;
    const noFundsResult = seed(defaultHarthmereJobsBoardState(NOW), NOW, {
      economy,
    });
    const businessJobs = Object.values(noFundsResult.jobsBoard.postings).filter(
      (j) => j.issuerKind === "business"
    );
    assert.equal(
      businessJobs.length,
      0,
      "business job posted despite empty balance"
    );
  });

  it("auto-seeds jobs for real open production businesses and skips closed, underfunded, or already-covered issuers", () => {
    const economy = defaultHarthmereProductionEconomyState();
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

    const first = seed(defaultHarthmereJobsBoardState(NOW), NOW, { economy });
    const businessJobs = Object.values(first.jobsBoard.postings).filter(
      (job) =>
        job.issuerKind === "business" && job.issuerId === "business_general"
    );
    assert.equal(businessJobs.length, 1);
    assert.equal(businessJobs[0].templateId, "general_trader_stock_rations");
    assert.ok(first.economy!.businesses.business_general.balanceGold < 500);
    assert.equal(
      Object.values(first.jobsBoard.postings).some(
        (job) => job.issuerId === "business_closed"
      ),
      false
    );
    assert.equal(
      Object.values(first.jobsBoard.postings).some(
        (job) => job.issuerId === "business_broke"
      ),
      false
    );

    const second = seed(first.jobsBoard, NOW + 1_000, {
      economy: first.economy,
    });
    const repeated = Object.values(second.jobsBoard.postings).filter(
      (job) =>
        job.issuerKind === "business" && job.issuerId === "business_general"
    );
    assert.equal(
      repeated.length,
      1,
      "auto-seed should not duplicate an active business template job"
    );
  });
});

describe("mmo_jobs_board_authority — monster hunting (current)", () => {
  it("pins every monster-hunt template to a seed-backed Muck bounty target", () => {
    assert.deepEqual(validateHarthmereJobsBoardMuckBountyTargets(), []);
    const huntTemplates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) => template.kind === "hunt" || template.monsterId
    );
    assert.ok(huntTemplates.length >= 3, "expected authored bounty templates");
    for (const template of huntTemplates) {
      const target = harthmereJobsBoardMuckBountyTargetForId(
        template.mapMarkerId ?? template.targetId
      );
      assert.ok(target, `${template.templateId} must use a Muck bounty target`);
      assert.equal(target!.monsterId, template.monsterId);
      assert.equal(target!.monsterTier, template.monsterTier);
      const marker = harthmereJobsBoardQuestMarkerPositionForId(
        template.mapMarkerId
      );
      assert.ok(marker, `${template.templateId} marker must resolve`);
      assert.equal(marker!.source, "muck_bounty_target");
      assert.deepEqual(marker!.position, target!.position);
      assert.ok(
        muckMonsterAreaForPosition(marker!.position, 1.5),
        `${template.templateId} must point inside Muck territory`
      );
    }
  });

  it("produces at least one Mucker or Hex hunt with party flag + loot hint over many ticks", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    // Run multiple ticks with different nowMs to exercise the rng selection.
    for (let i = 0; i < 30; i++) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const hunts = Object.values(state.postings).filter(
      (job) => job.kind === "hunt"
    );
    assert.ok(
      hunts.length > 0,
      "no monster hunt postings appeared across 30 ticks"
    );
    for (const hunt of hunts) {
      assert.ok(
        ["mucker", "hex"].includes(String(hunt.monsterId)),
        `unexpected monsterId: ${hunt.monsterId}`
      );
      assert.equal(hunt.partyRecommended, true);
      assert.ok(
        (hunt.partyMinSize ?? 0) >= 3,
        "party min size should be 3+ for monster hunts"
      );
      assert.ok(
        ["strong", "elite", "boss"].includes(String(hunt.monsterTier)),
        `monster tier should be strong+, got ${hunt.monsterTier}`
      );
      assert.ok(
        hunt.rewardGold >= HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR,
        `monster hunt reward ${hunt.rewardGold} below floor`
      );
      assert.ok(
        Array.isArray(hunt.lootHint) && hunt.lootHint.length > 0,
        "monster hunt should advertise loot hint"
      );
    }
  });

  it("randomizes Mucker and Hex hunt coordinates across generated postings", () => {
    const byTemplate = new Map<string, Set<string>>();
    for (const boardId of [
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
    ]) {
      seedLiveBoardRounds(boardId, 300, (state) => {
        for (const job of autoPostings(state)) {
          if (job.monsterId !== "mucker" && job.monsterId !== "hex") continue;
          const target = harthmereJobsBoardMuckBountyTargetForId(
            job.mapMarkerId
          );
          assert.ok(target, `${job.templateId} should use a bounty marker`);
          assert.equal(target!.monsterId, job.monsterId);
          assert.ok(
            muckMonsterAreaForPosition(target!.position, 1.5),
            `${job.templateId} target must stay in muck territory`
          );
          const set = byTemplate.get(job.templateId ?? "") ?? new Set<string>();
          set.add(target!.position.map((value) => value.toFixed(2)).join(","));
          byTemplate.set(job.templateId ?? "", set);
        }
      });
    }

    for (const templateId of [
      "hunt_mucker_elite",
      "hunt_hex_boss",
      "hunt_mucker_alpha",
    ]) {
      assert.ok(
        (byTemplate.get(templateId)?.size ?? 0) > 1,
        `${templateId} should rotate between multiple live coordinates`
      );
    }
  });

  it("uses physical pickup markers and preserves authored delivery pickups", () => {
    const pickupsByTemplate = new Map<string, Set<string>>();
    const dropoffsByTemplate = new Map<string, Set<string>>();
    const seen = new Set<string>();
    for (const boardId of [
      HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
    ]) {
      seedLiveBoardRounds(boardId, 300, (state) => {
        for (const job of autoPostings(state)) {
          if (job.kind !== "delivery") continue;
          const req = job.requirements.find((requirement) =>
            Boolean(requirement.itemId)
          );
          if (!req) continue;
          seen.add(job.templateId ?? "");
          assert.ok(
            req.pickupMarkerId,
            `${job.templateId} should require a pickup marker`
          );
          const pickupMarker = harthmereJobsBoardQuestMarkerPositionForId(
            req.pickupMarkerId
          );
          assert.ok(
            pickupMarker,
            `${job.templateId} pickup marker should resolve`
          );
          assert.notEqual(
            pickupMarker!.source,
            "business_outpost",
            `${job.templateId} pickup must be an F-interactable prop, not an outpost navigation marker`
          );
          assert.ok(
            req.mapMarkerId,
            `${job.templateId} should require a drop-off marker`
          );
          assert.ok(
            harthmereJobsBoardQuestMarkerPositionForId(req.mapMarkerId),
            `${job.templateId} drop-off marker should resolve`
          );
          assert.notEqual(
            req.pickupMarkerId,
            req.mapMarkerId,
            `${job.templateId} pickup and drop-off markers should differ`
          );
          const pickups =
            pickupsByTemplate.get(job.templateId ?? "") ?? new Set<string>();
          pickups.add(req.pickupMarkerId!);
          pickupsByTemplate.set(job.templateId ?? "", pickups);
          const dropoffs =
            dropoffsByTemplate.get(job.templateId ?? "") ?? new Set<string>();
          dropoffs.add(req.mapMarkerId!);
          dropoffsByTemplate.set(job.templateId ?? "", dropoffs);
        }
      });
    }

    assert.ok(seen.has("npc_delivery_apples"));
    assert.deepEqual(
      [...(pickupsByTemplate.get("npc_delivery_apples") ?? [])],
      ["coop_supply_box"]
    );
    assert.ok(
      (dropoffsByTemplate.get("npc_delivery_apples")?.size ?? 0) > 1,
      "Run the Coop should keep its physical Coop pickup while drop-offs rotate"
    );

    for (const templateId of [
      "harthmere_town_market_delivery",
      "harthmere_npc_courier_bridge",
    ]) {
      assert.ok(seen.has(templateId), `${templateId} should appear in samples`);
      assert.ok(
        (pickupsByTemplate.get(templateId)?.size ?? 0) > 1,
        `${templateId} should rotate pickup locations`
      );
      assert.ok(
        (dropoffsByTemplate.get(templateId)?.size ?? 0) > 1,
        `${templateId} should rotate drop-off locations`
      );
    }
  });

  it("lets a pickup delivery collect the parcel before drop-off completion", () => {
    let seeded = seed(defaultHarthmereJobsBoardState(NOW), NOW);
    let job = Object.values(seeded.jobsBoard.postings).find(
      (candidate) =>
        candidate.kind === "delivery" &&
        candidate.requirements.some((req) => req.pickupMarkerId)
    );
    for (let i = 1; !job && i < 40; i += 1) {
      seeded = seed(defaultHarthmereJobsBoardState(NOW), NOW + i * 10_000);
      job = Object.values(seeded.jobsBoard.postings).find(
        (candidate) =>
          candidate.kind === "delivery" &&
          candidate.requirements.some((req) => req.pickupMarkerId)
      );
    }
    assert.ok(job, "expected a generated pickup delivery");
    const req = job!.requirements.find((entry) => entry.itemId)!;

    const accept = reduceHarthmereJobsBoardMutation(
      seeded.jobsBoard,
      {
        requestId: "accept-pickup-delivery",
        actorId: "seeker",
        nowMs: NOW + 1_000,
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
      } as any,
      seedContext()
    );
    assert.deepEqual(
      accept.inventoryItemDeltas,
      {},
      "pickup deliveries must not grant the parcel on accept"
    );
    const todo = Object.values(accept.jobsBoard.todos).find(
      (entry) => entry.jobId === job!.jobId
    );
    assert.ok(todo);

    const pickedUp = reduceHarthmereJobsBoardMutation(
      accept.jobsBoard,
      {
        requestId: "pickup-delivery-parcel",
        actorId: "seeker",
        nowMs: NOW + 2_000,
        operation: "pickup_delivery_parcel",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
        questTodoId: todo!.todoId,
        completedTargetId: req.pickupMarkerId,
      } as any,
      seedContext()
    );
    assert.deepEqual(pickedUp.warnings, []);
    assert.deepEqual(pickedUp.inventoryItemDeltas, {
      [req.itemId!]: req.count ?? 1,
    });
    assert.equal(
      Object.values(pickedUp.jobsBoard.todos).find(
        (entry) => entry.jobId === job!.jobId
      )?.status,
      "active"
    );

    const delivered = reduceHarthmereJobsBoardMutation(
      pickedUp.jobsBoard,
      {
        requestId: "deliver-picked-up-parcel",
        actorId: "seeker",
        nowMs: NOW + 3_000,
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
        questTodoId: todo!.todoId,
        completedTargetId: req.recipientNpcId
          ? `harthmere_owner:${req.recipientNpcId}`
          : req.mapMarkerId,
      } as any,
      fieldCompletionContext(job!, {
        actorInventoryItems: { [req.itemId!]: req.count ?? 1 },
      })
    );
    assert.deepEqual(delivered.warnings, []);
    assert.deepEqual(delivered.inventoryItemDeltas, {
      [req.itemId!]: -(req.count ?? 1),
    });
  });

  it("resolves every Grove auto-seeded field-work marker to a world coordinate", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 30; i += 1) {
      state = seed(state, NOW + i * 1000).jobsBoard;
    }
    const markerIds = Object.values(state.postings)
      .map((job) => job.mapMarkerId)
      .filter((markerId): markerId is string => Boolean(markerId));
    assert.deepEqual(unresolvedHarthmereJobsBoardQuestMarkerIds(markerIds), []);
    const hunt = Object.values(state.postings).find(
      (job) => job.kind === "hunt" && job.mapMarkerId
    );
    assert.ok(hunt, "expected at least one Grove monster hunt marker");
    const marker = harthmereJobsBoardQuestMarkerPositionForId(
      hunt!.mapMarkerId
    );
    assert.ok(marker, `hunt marker should resolve: ${hunt!.mapMarkerId}`);
    assert.notDeepEqual(
      marker!.position,
      [482, 66, -198],
      "monster hunts must not point at the old generic placeholder"
    );
  });

  it("keeps Grove board variety templates obtainable instead of filtering them out", () => {
    const groveTemplates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) =>
        ((template as any).boardScope ?? "any") !== "harthmere" &&
        harthmereAutoSeedTemplateRequirementsObtainable(template.requirements)
    );
    const groveKinds = new Set(groveTemplates.map((template) => template.kind));

    for (const kind of [
      "gather",
      "delivery",
      "repair",
      "cleanup",
      "hunt",
      "escort",
      "craft",
    ]) {
      assert.ok(
        groveKinds.has(kind as any),
        `Grove board should auto-seed ${kind} jobs`
      );
    }
    const byId = new Map(
      groveTemplates.map((template) => [template.templateId, template])
    );
    assert.equal(
      byId.get("npc_delivery_apples")?.requirements[0]?.itemId,
      "sealed_package"
    );
    assert.equal(
      byId.get("business_craft_torch")?.requirements[0]?.itemId,
      "wood_plank"
    );
    assert.equal(
      byId.get("town_cleanup_muck_patch")?.requirements[0]?.itemId,
      undefined
    );
    assert.equal(
      byId.get("town_cleanup_muck_patch")?.requirements[0]?.requiredToolAction,
      "cleanup"
    );
  });

  it("fills the Grove board with varied job kinds before repeating templates", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 10; i += 1) {
      state = seed(state, NOW + i * 1_000).jobsBoard;
    }
    const openKinds = new Set(
      Object.values(state.postings)
        .filter(
          (job) =>
            job.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID &&
            job.status === "open"
        )
        .map((job) => job.kind)
    );
    for (const kind of [
      "gather",
      "delivery",
      "repair",
      "cleanup",
      "hunt",
      "escort",
      "craft",
    ]) {
      assert.ok(
        openKinds.has(kind as any),
        `open Grove jobs should include ${kind}`
      );
    }
  });

  it("routes every auto-seeded escort to a remote named protection landmark", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 10; i += 1) {
      state = seed(state, NOW + i * 1_000).jobsBoard;
    }
    const escort = Object.values(state.postings).find(
      (job) => job.kind === "escort"
    );
    assert.ok(escort, "expected an auto-seeded escort job");
    assert.match(escort!.mapMarkerId ?? "", /^legacy_protection_field:/);
    const marker = harthmereJobsBoardQuestMarkerPositionForId(
      escort!.mapMarkerId
    );
    assert.ok(marker, "escort destination must resolve on the shared map");
    assert.ok(
      Math.hypot(
        marker!.position[0] - 501.99486179104775,
        marker!.position[2] - -132.00350672753194
      ) >= HARTHMERE_ESCORT_DESTINATION_MIN_DISTANCE,
      "escort destination must not complete beside the board"
    );
    assert.equal(
      escort!.requirements[0]?.targetName,
      marker!.label,
      "quest copy and map label must use the same player-readable name"
    );
  });

  it("auto-posted jobs accept and complete through the existing pipeline (rewards reach the seeker)", () => {
    const seeded = seed(defaultHarthmereJobsBoardState(NOW), NOW);
    // PICK BY WHAT THIS TEST EXERCISES, NOT BY DRAW ORDER.
    //
    // This used to take `Object.values(postings)[0]`, which silently depended
    // on which template the RNG happened to place first. That made the test a
    // hostage to the seed: HARTHMERE_JOBS_BOARD_SEED_DETERMINISM changed the
    // draw order and slot 0 became a monster hunt, which cannot complete
    // through this path at all — a hunt is closed by the native kill ledger
    // (`jobs_board_native_bounty_authority.test.ts`), not by field completion.
    //
    // The pipeline under test here is accept -> field completion -> reward, so
    // select a job that actually uses it.
    const job = Object.values(seeded.jobsBoard.postings).find(
      (candidate) => !candidate.monsterId
    );
    assert.ok(job, "expected at least one seeded non-hunt job");

    const accept = reduceHarthmereJobsBoardMutation(
      seeded.jobsBoard,
      {
        requestId: "accept",
        actorId: "seeker",
        nowMs: NOW + 1_000,
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job.jobId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems: {},
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }
    );
    assert.equal(accept.jobsBoard.postings[job.jobId].status, "active");

    // Build the actor inventory to satisfy whatever the seeded job needs.
    const actorInventoryItems: Record<string, number> = {};
    for (const req of job.requirements) {
      if (req.itemId) actorInventoryItems[req.itemId] = req.count ?? 1;
    }

    const questDone = reduceHarthmereJobsBoardMutation(
      accept.jobsBoard,
      {
        requestId: "quest_done",
        actorId: "seeker",
        nowMs: NOW + 2_000,
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job.jobId,
        completedTargetId:
          job.targetId ??
          job.requirements.find((req) => req.targetId)?.targetId,
        usedToolAction: job.requirements.find((req) => req.requiredToolAction)
          ?.requiredToolAction,
      } as any,
      fieldCompletionContext(job, {
        actorGold: 0,
        actorInventoryItems,
        authoritativeEquippedToolActions: job.requirements
          .map((requirement) => requirement.requiredToolAction)
          .filter((action): action is string => Boolean(action)),
      })
    );
    assert.equal(questDone.jobsBoard.postings[job.jobId].status, "active");
    assert.equal(
      Object.values(questDone.jobsBoard.todos).find(
        (todo) => todo.jobId === job.jobId
      )?.status,
      "completed"
    );

    const complete = reduceHarthmereJobsBoardMutation(
      questDone.jobsBoard,
      {
        requestId: "complete",
        actorId: "seeker",
        nowMs: NOW + 3_000,
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job.jobId,
      } as any,
      {
        actorGold: 0,
        actorInventoryItems: {},
        nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      }
    );
    assert.equal(complete.jobsBoard.postings[job.jobId].status, "completed");
    assert.equal(complete.inventoryGoldDelta, job.rewardGold);
  });

  it("completes the Road Rations gather job only after the seeker has the required berries, then pays out at the Grove board", () => {
    const seeded = seed(defaultHarthmereJobsBoardState(NOW), NOW);
    const job = Object.values(seeded.jobsBoard.postings).find(
      (candidate) => candidate.templateId === "town_gather_road_rations"
    );
    assert.ok(job, "Road Rations gather job should be auto-posted");
    assert.equal(job!.mapMarkerId, "grove_garden_edge_berries");
    assert.equal(job!.requiresFieldWork, false);

    const accept = reduceHarthmereJobsBoardMutation(
      seeded.jobsBoard,
      {
        requestId: "accept-road-rations",
        actorId: "seeker",
        nowMs: NOW + 1_000,
        operation: "accept_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
      } as any,
      seedContext()
    );
    const todo = Object.values(accept.jobsBoard.todos).find(
      (entry) => entry.jobId === job!.jobId
    );
    assert.equal(todo?.mapMarkerId, "grove_garden_edge_berries");

    const missing = reduceHarthmereJobsBoardMutation(
      accept.jobsBoard,
      {
        requestId: "missing-road-rations",
        actorId: "seeker",
        nowMs: NOW + 2_000,
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
        questTodoId: todo?.todoId,
      } as any,
      fieldCompletionContext(job!, {
        actorInventoryItems: { wild_berries: 5 },
      })
    );
    assert.ok(
      missing.warnings.includes(
        "jobs_board_rejected:missing_completion_item:wild_berries"
      )
    );

    const questDone = reduceHarthmereJobsBoardMutation(
      accept.jobsBoard,
      {
        requestId: "complete-road-rations-quest",
        actorId: "seeker",
        nowMs: NOW + 3_000,
        operation: "complete_job_quest",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
        questTodoId: todo?.todoId,
      } as any,
      fieldCompletionContext(job!, {
        actorInventoryItems: { wild_berries: 6 },
      })
    );
    assert.deepEqual(questDone.inventoryItemDeltas, { wild_berries: -6 });
    assert.equal(
      Object.values(questDone.jobsBoard.todos).find(
        (entry) => entry.jobId === job!.jobId
      )?.status,
      "completed"
    );

    const paid = reduceHarthmereJobsBoardMutation(
      questDone.jobsBoard,
      {
        requestId: "pay-road-rations",
        actorId: "seeker",
        nowMs: NOW + 4_000,
        operation: "complete_job",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        jobId: job!.jobId,
      } as any,
      seedContext()
    );
    assert.equal(paid.jobsBoard.postings[job!.jobId].status, "completed");
    assert.equal(paid.inventoryGoldDelta, job!.rewardGold);
  });
});

describe("mmo_jobs_board_authority — Exotic Matter mining jobs", () => {
  it("registers high-paying Harthmere mining templates for every Exotic Matter material", () => {
    const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) => isHarthmereExoticMatterMiningTemplateId(template.templateId)
    );
    assert.equal(templates.length, 6);

    const itemIds = new Set<string>();
    const deepTemplateIds = new Set<string>();
    for (const template of templates) {
      assert.equal(template.boardScope, "harthmere");
      assert.equal(template.kind, "gather");
      assert.equal(template.requiresFieldWork, true);
      assert.ok(template.rewardGold.min >= 3200, template.templateId);
      assert.equal(
        template.rewardGold.max,
        HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD
      );
      assert.ok(template.mapMarkerId, template.templateId);
      const marker = harthmereJobsBoardQuestMarkerPositionForId(
        template.mapMarkerId
      );
      assert.ok(marker, `${template.templateId} marker should resolve`);
      assert.equal(marker!.source, "exotic_matter_deposit");
      assert.ok(
        !template.mapMarkerId?.includes("windowlight"),
        `${template.templateId} should not target the light/no-job cave`
      );
      const deposit = harthmereExoticMatterDepositById(template.mapMarkerId);
      assert.ok(
        deposit,
        `${template.templateId} should point at a real deposit`
      );
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
        assert.ok(isHarthmereExoticMatterMaterialItemId(requirement.itemId));
        assert.ok(
          isKnownHarthmereJobsBoardExecutableItemId(requirement.itemId!),
          requirement.itemId
        );
        itemIds.add(requirement.itemId!);
      }
    }
    assert.deepEqual(
      [...itemIds].sort(),
      [...HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS].sort()
    );
    assert.deepEqual([...deepTemplateIds].sort(), [
      "deep_exotic_matter_mine_antiboron",
      "deep_exotic_matter_mine_antihelium",
      "deep_exotic_matter_mine_antihydrogen",
    ]);
  });

  it("primes the Harthmere board with a random Exotic Matter mining job when none are open", () => {
    const result = seedBoard(
      defaultHarthmereJobsBoardState(NOW),
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      NOW
    );
    const exoticJob = autoPostings(result.jobsBoard).find((job) =>
      isHarthmereExoticMatterMiningTemplateId(job.templateId)
    );

    assert.ok(
      exoticJob,
      "expected random Harthmere seeding to surface an Exotic Matter mining job"
    );
    assert.equal(exoticJob!.boardId, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID);
    assert.ok(exoticJob!.rewardGold >= 3200);
    assert.ok(exoticJob!.requiresFieldWork);
    assert.ok(
      exoticJob!.requirements.some((requirement) =>
        isHarthmereExoticMatterMaterialItemId(requirement.itemId)
      )
    );
  });

  it("can randomly surface every Exotic Matter mining template on the Harthmere board", () => {
    const expected = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
      (template) => isHarthmereExoticMatterMiningTemplateId(template.templateId)
    )
      .map((template) => template.templateId)
      .sort();
    const seen = new Set<string>();

    seedLiveBoardRounds(
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      500,
      (state) => {
        for (const job of autoPostings(state)) {
          if (isHarthmereExoticMatterMiningTemplateId(job.templateId)) {
            seen.add(job.templateId!);
          }
        }
      },
      () => seen.size >= expected.length
    );

    assert.deepEqual([...seen].sort(), expected);
  });

  it("does not auto-post Exotic Matter mining jobs on the Grove board", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 20; i += 1) {
      state = seedBoard(
        state,
        HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        NOW + i * 17_000
      ).jobsBoard;
    }

    assert.equal(
      autoPostings(state).some((job) =>
        isHarthmereExoticMatterMiningTemplateId(job.templateId)
      ),
      false
    );
  });
});
