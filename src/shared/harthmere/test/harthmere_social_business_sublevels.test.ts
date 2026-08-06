import assert from "assert";
import { resolveHarthmereLockpickAttempt } from "../harthmere_sublevel_benefits";
import {
  defaultHarthmereFoodStaminaState,
  huntHarthmereAnimalForFood,
} from "../mmo_farming_food_stamina";
import {
  defaultHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyMutationContext,
  type HarthmereProductionEconomyState,
} from "../mmo_economy_authority";
import {
  negotiateHarthmereBusinessEmployeeCandidate,
  type HarthmereBusinessEmployeeCandidate,
} from "../business_employee_ai";
import {
  reduceHarthmereInventoryMutation,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
} from "../mmo_inventory_authority";

const NOW = 1_800_000_000_000;

function economyContext(
  skillLevels: Record<string, number | undefined> = {}
): HarthmereEconomyMutationContext {
  return {
    actorGold: 50_000,
    actorInventoryItems: {},
    canManageGuildBusiness: () => false,
    canManageTownBusiness: () => false,
    allowNpcAdministration: false,
    actorSkillLevels: skillLevels,
  };
}

function openBusiness(): {
  state: HarthmereProductionEconomyState;
  businessId: string;
} {
  const context = economyContext();
  let result = reduceHarthmereEconomyMutation(
    defaultHarthmereProductionEconomyState(),
    {
      requestId: "social-business-register",
      actorId: "social_actor",
      nowMs: NOW,
      operation: "register_business",
      businessType: "general_trader",
      name: "Sublevel Store",
    },
    context
  );
  const businessId = Object.keys(result.economy.businesses)[0];
  result = reduceHarthmereEconomyMutation(
    result.economy,
    {
      requestId: "social-business-license",
      actorId: "social_actor",
      nowMs: NOW,
      operation: "issue_license",
      businessId,
      licenseLevel: 1,
    },
    context
  );
  result = reduceHarthmereEconomyMutation(
    result.economy,
    {
      requestId: "social-business-open",
      actorId: "social_actor",
      nowMs: NOW,
      operation: "open_business",
      businessId,
      propertyId: "social_property",
      townId: "harthmere_grove",
    },
    context
  );
  assert.deepEqual(result.warnings, []);
  return { state: result.economy, businessId };
}

describe("Harthmere exploration, social, and business sublevels", () => {
  it("makes mastered Lockpicking faster, cheaper, and more reliable", () => {
    const novice = resolveHarthmereLockpickAttempt({
      lockpickingLevel: 1,
      difficultyLevel: 35,
      baseDurationMs: 4_000,
      baseDurabilityCost: 10,
      seed: "same-lock",
    });
    const master = resolveHarthmereLockpickAttempt({
      lockpickingLevel: 100,
      difficultyLevel: 35,
      baseDurationMs: 4_000,
      baseDurabilityCost: 10,
      seed: "same-lock",
    });
    assert.ok(master.chance > novice.chance);
    assert.equal(master.durationMs, 3_200);
    assert.equal(master.durabilityCost, 8);
  });

  it("lets Tracking improve authoritative wild-animal harvests", () => {
    let foundBonus = false;
    for (let offset = 0; offset < 100 && !foundBonus; offset += 1) {
      const state = defaultHarthmereFoodStaminaState("tracker", NOW + offset);
      state.spawns.boar = {
        spawnId: "boar",
        kind: "animal",
        hp: 0,
        maxHp: 20,
      };
      const result = huntHarthmereAnimalForFood(state, {
        animalId: "boar",
        nowMs: NOW + offset,
        trackingSkillLevel: 100,
      });
      foundBonus = result.inventoryDeltas.raw_meat === 3;
    }
    assert.equal(foundBonus, true);
  });

  it("applies Persuasion to vendor buy and sell prices", () => {
    registerHarthmereItemDefinition({
      itemId: "persuasion_trade_fixture",
      displayName: "Persuasion Trade Fixture",
      category: "materials",
      maxStackSize: 99,
      levelRequirement: 1,
      tradeable: true,
      binding: "none",
      stats: {},
    } as any);
    registerHarthmereVendorEntry({
      vendorId: "persuasion_vendor",
      itemId: "persuasion_trade_fixture",
      buyPrice: 100,
      sellPrice: 50,
      stock: -1,
    });
    const snapshot = {
      actorId: "trade_actor",
      gold: 1_000,
      equipment: {},
      items: {},
      bank: {},
      escrow: {},
      consumableCooldowns: {},
      knownAbilities: [],
      knownRecipes: [],
    };
    const buy = reduceHarthmereInventoryMutation(
      {
        requestId: "persuasion-buy",
        actorId: "trade_actor",
        kind: "buy_from_vendor",
        itemId: "persuasion_trade_fixture",
        vendorId: "persuasion_vendor",
        count: 1,
      },
      {
        snapshot,
        playerLevel: 1,
        playerSkills: { persuasion: { level: 100 } },
        reputation: {},
      }
    );
    assert.equal(buy.goldDelta, -95);

    snapshot.items.persuasion_trade_fixture = 1;
    const sell = reduceHarthmereInventoryMutation(
      {
        requestId: "persuasion-sell",
        actorId: "trade_actor",
        kind: "sell_to_vendor",
        itemId: "persuasion_trade_fixture",
        vendorId: "persuasion_vendor",
        count: 1,
      },
      {
        snapshot,
        playerLevel: 1,
        playerSkills: { persuasion: { level: 100 } },
        reputation: {},
      }
    );
    assert.equal(sell.goldDelta, 52);
  });

  it("lets Persuasion secure a lower employee wage", () => {
    const candidate = {
      candidateId: "candidate",
      businessId: "business",
      displayName: "Steady Worker",
      role: "Clerk",
      skill: 3,
      wageAskGoldPerDay: 100,
      personality: "steady",
      schedule: "day",
      workplacePreference: "counter",
      preferredTaskId: "serve_customers",
      status: "interviewed",
      negotiationRounds: 0,
      generatedAtMs: NOW,
      expiresAtMs: NOW + 10_000,
      notes: [],
    } as HarthmereBusinessEmployeeCandidate;
    assert.equal(
      negotiateHarthmereBusinessEmployeeCandidate(candidate, 78, 1).accepted,
      false
    );
    assert.equal(
      negotiateHarthmereBusinessEmployeeCandidate(candidate, 78, 100).accepted,
      true
    );
  });

  it("keeps every skill tier on the same ten-customer two-second shift clock", () => {
    const setup = openBusiness();
    const novice = reduceHarthmereEconomyMutation(
      setup.state,
      {
        requestId: "social-session-novice",
        actorId: "social_actor",
        nowMs: NOW,
        operation: "start_business_customer_session",
        businessId: setup.businessId,
      },
      economyContext({ performance: 1, business_operations: 1 })
    );
    const master = reduceHarthmereEconomyMutation(
      setup.state,
      {
        requestId: "social-session-master",
        actorId: "social_actor",
        nowMs: NOW,
        operation: "start_business_customer_session",
        businessId: setup.businessId,
      },
      economyContext({ performance: 100, business_operations: 100 })
    );
    const noviceSession = Object.values(
      novice.economy.businessSystems!.customerSessions
    )[0];
    const masterSession = Object.values(
      master.economy.businessSystems!.customerSessions
    )[0];
    assert.equal(noviceSession.queue.length, 10);
    assert.equal(masterSession.queue.length, 10);
    assert.deepEqual(
      noviceSession.queue.map((ticket) => ticket.patience),
      [30, 28, 26, 24, 22, 20, 18, 16, 14, 12]
    );
    assert.deepEqual(
      masterSession.queue.map((ticket) => ticket.patience),
      noviceSession.queue.map((ticket) => ticket.patience)
    );
  });
});
