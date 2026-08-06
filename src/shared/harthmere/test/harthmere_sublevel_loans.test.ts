import assert from "assert";
import {
  HARTHMERE_LOAN_DAILY_INTEREST_RATE,
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  HARTHMERE_ECONOMY_DAY_MS,
  defaultHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyMutationContext,
} from "../mmo_economy_authority";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";

const NOW = 1_800_000_000_000;

describe("Harthmere sublevel loan authority", () => {
  it("applies mastered Persuasion to personal principal, interest, and term", () => {
    const state = defaultHarthmereLiveModeBackendState("loan_actor", NOW);
    state.classMagic.skills.persuasion = { xp: 0, level: 100 };
    const envelope: HarthmereLiveModeAuthorityEnvelope = {
      requestId: "loan-personal-master",
      idempotencyKey: "loan-personal-master",
      actorId: "loan_actor",
      actionKind: "request_bank_transaction",
      subsystem: "economy",
      source: "client_request",
      serverReceivedAtMs: NOW,
      serverTick: 1,
      actorEntityVersion: 1,
      zoneId: "harthmere_grove",
      payload: { operation: "take_loan", amount: 312, days: 37 },
      clientClaims: {},
    };
    const result = reduceHarthmereLiveModeBackendState(state, envelope, NOW);
    const loan = Object.values(result.state.banking.loans)[0];
    assert.ok(loan);
    assert.equal(loan.principalOriginal, 312);
    assert.equal(loan.dailyInterestRate, HARTHMERE_LOAN_DAILY_INTEREST_RATE * 0.8);
    assert.equal(loan.dueAtMs, NOW + 37 * HARTHMERE_ECONOMY_DAY_MS);
  });

  it("uses Business Operations for capacity and Persuasion for business rate and term", () => {
    const context: HarthmereEconomyMutationContext = {
      actorGold: 50_000,
      actorInventoryItems: {},
      canManageGuildBusiness: () => false,
      canManageTownBusiness: () => false,
      allowNpcAdministration: false,
      actorSkillLevels: { business_operations: 100, persuasion: 100 },
    };
    const registered = reduceHarthmereEconomyMutation(
      defaultHarthmereProductionEconomyState(),
      {
        requestId: "loan-business-register",
        actorId: "loan_actor",
        nowMs: NOW,
        operation: "register_business",
        businessType: "general_trader",
        name: "Master Ledger",
      },
      context
    );
    assert.deepEqual(registered.warnings, []);
    const businessId = Object.keys(registered.economy.businesses)[0];
    const borrowed = reduceHarthmereEconomyMutation(
      registered.economy,
      {
        requestId: "loan-business-borrow",
        actorId: "loan_actor",
        nowMs: NOW,
        operation: "take_business_loan",
        businessId,
        principalGold: 625,
        dailyInterestRate: 0.015,
        dueAtMs: NOW + 30 * HARTHMERE_ECONOMY_DAY_MS,
      },
      context
    );
    assert.deepEqual(borrowed.warnings, []);
    const loan = Object.values(borrowed.economy.loans)[0];
    assert.equal(loan.principalOriginal, 625);
    assert.equal(loan.dailyInterestRate, 0.012);
    assert.equal(loan.dueAtMs, NOW + 21 * HARTHMERE_ECONOMY_DAY_MS);
  });
});
