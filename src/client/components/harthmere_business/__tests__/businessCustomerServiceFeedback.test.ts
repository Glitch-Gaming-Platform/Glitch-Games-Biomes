import { strict as assert } from "assert";
import type {
  HarthmereBusinessCustomerSession,
  HarthmereBusinessCustomerStats,
} from "@/shared/harthmere/business_customer_simulator";
import { createHarthmereBusinessCustomerServiceFeedback } from "../harthmereBusinessCustomerServiceFeedback";

function session(
  overrides: Partial<HarthmereBusinessCustomerSession> = {}
): HarthmereBusinessCustomerSession {
  return {
    sessionId: "session_1",
    businessId: "business_clinic",
    typeId: "medical_doctor",
    actorId: "player",
    status: "active",
    startedAtMs: 1,
    expiresAtMs: 1000,
    currentTicketId: "ticket_1",
    queue: [
      {
        ticketId: "ticket_1",
        entityId: 1 as any,
        npcId: "customer",
        askId: "checkup",
        requestedOfferId: "basic_checkup",
        askLine: "I need a checkup.",
        status: "waiting",
        arrivedAtMs: 1,
        patience: 30,
        patienceRemaining: 20,
        difficulty: 2,
        rewardGold: 20,
        reputationDelta: 1,
        needDelta: 1,
        navGoal: "counter",
        spatialPhase: "serving",
        reaction: "neutral",
        queueIndex: 0,
      },
    ],
    servedTicketIds: [],
    failedTicketIds: [],
    streak: 0,
    satisfaction: 50,
    earnedGold: 0,
    progressPoints: 0,
    dailyBonusGold: 10,
    notes: [],
    ...overrides,
  };
}

function stats(
  overrides: Partial<HarthmereBusinessCustomerStats> = {}
): HarthmereBusinessCustomerStats {
  return {
    businessId: "business_clinic",
    totalServed: 0,
    totalFailed: 0,
    lifetimeGold: 0,
    bestStreak: 0,
    currentTier: 1,
    serviceXp: 0,
    likeability: 0,
    friendshipPointsByNpcId: {},
    favoriteCustomerNpcIds: [],
    repeatCustomerMemories: [],
    thankYouNotes: [],
    collectiblesEarned: [],
    decorationUnlocks: [],
    badges: [],
    ...overrides,
  };
}

describe("Harthmere business customer service feedback", () => {
  it("shows every authoritative reward after a correct answer", () => {
    const beforeSession = session();
    const afterSession = session({
      earnedGold: 33,
      progressPoints: 3,
      satisfaction: 56,
      servedTicketIds: ["ticket_1"],
      queue: [{ ...beforeSession.queue[0], status: "served" }],
    });
    const result = createHarthmereBusinessCustomerServiceFeedback({
      customerName: "Jorek Linn",
      ticketId: "ticket_1",
      selectedOfferLabel: "Run checkup",
      expectedOfferLabel: "Run checkup",
      beforeSession,
      afterSession,
      beforeStats: stats(),
      afterStats: stats({
        serviceXp: 4,
        likeability: 1,
        collectiblesEarned: ["clinic_pin"],
      }),
    });

    assert.equal(result.correct, true);
    assert.equal(result.goldEarned, 33);
    assert.equal(result.progressPointsEarned, 3);
    assert.equal(result.serviceXpEarned, 4);
    assert.match(result.message, /^Correct!/);
    assert.match(result.message, /33 gold/);
    assert.match(result.message, /3 business points/);
    assert.match(result.message, /4 service XP/);
    assert.match(result.message, /collectible: clinic pin/);
  });

  it("names the correct service and zero payout after an incorrect answer", () => {
    const beforeSession = session();
    const result = createHarthmereBusinessCustomerServiceFeedback({
      customerName: "Jorek Linn",
      ticketId: "ticket_1",
      selectedOfferLabel: "Issue medkit",
      expectedOfferLabel: "Run checkup",
      beforeSession,
      afterSession: session({
        satisfaction: 42,
        failedTicketIds: ["ticket_1"],
        queue: [{ ...beforeSession.queue[0], status: "failed" }],
      }),
      beforeStats: stats(),
      afterStats: stats({ totalFailed: 1 }),
    });

    assert.equal(result.correct, false);
    assert.equal(result.goldEarned, 0);
    assert.equal(result.satisfactionDelta, -8);
    assert.match(result.message, /^Incorrect\./);
    assert.match(result.message, /needed Run checkup/);
    assert.match(result.message, /you chose Issue medkit/);
    assert.match(result.message, /0 gold and 0 business points/);
  });
});
